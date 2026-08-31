import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { extractBrands, MIN_BRAND_STORES } from '../brands';
import type { Shop, ShopRaw } from '../shops';

/** 테스트용 매장 + 원본 쌍 생성기(한국어 원제를 title 괄호에 담는다). */
function make(id: string, name: string, koreanTitle: string): { shop: Shop; raw: ShopRaw } {
  return {
    shop: { id, name, addr: null, lat: 37.5, lon: 127, image: null, tel: null, taxRefund: true, brand: null },
    raw: { contentid: id, title: `${name}(${koreanTitle})` },
  };
}

describe('extractBrands — 선두 토큰 빈도로 자동 추출(하드코딩 없음)', () => {
  it('임계 이상 선두 토큰만 브랜드가 된다', () => {
    const pairs: { shop: Shop; raw: ShopRaw }[] = [];
    // 올리브영 매장 MIN 개 + 유일 매장 하나.
    for (let i = 0; i < MIN_BRAND_STORES; i += 1) {
      pairs.push(make(`oy${i}`, `Olive Young Store ${i}`, `올리브영 ${i}호점`));
    }
    pairs.push(make('x1', 'Lonely Boutique', '외톨이 부티크 명동점'));

    const { brands, brandByShopId } = extractBrands(
      pairs.map((p) => p.shop),
      pairs.map((p) => p.raw),
    );
    // 올리브영은 브랜드, 외톨이는 미배정.
    assert.equal(brands.length, 1);
    assert.equal(brands[0].key, '올리브영');
    assert.equal(brands[0].count, MIN_BRAND_STORES);
    assert.equal(brandByShopId.get('oy0'), '올리브영');
    assert.equal(brandByShopId.has('x1'), false);
  });

  it('라벨은 현지어 매장명에서 유도하고 지점 꼬리를 자른다', () => {
    const pairs: { shop: Shop; raw: ShopRaw }[] = [];
    for (let i = 0; i < MIN_BRAND_STORES; i += 1) {
      pairs.push(make(`n${i}`, `Nike - Lotte Store ${i}`, `나이키 롯데 ${i}점`));
    }
    const { brands } = extractBrands(pairs.map((p) => p.shop), pairs.map((p) => p.raw));
    assert.equal(brands[0].label, 'Nike'); // "Nike - Lotte..." 에서 브랜드만
  });

  it('입점 건물(몰) 이름은 브랜드가 되지 않는다 — 첫 토큰이 아니므로', () => {
    // 서로 다른 브랜드가 모두 "롯데프리미엄아울렛"을 이름 중간에 갖는 경우.
    const pairs: { shop: Shop; raw: ShopRaw }[] = [];
    const middleBrands = ['르꼬끄', '아디다스', '나이키', '뉴발란스', '컬럼비아'];
    for (let i = 0; i < MIN_BRAND_STORES + 5; i += 1) {
      const b = middleBrands[i % middleBrands.length];
      pairs.push(make(`m${i}`, `Store ${i}`, `${b} 롯데프리미엄아울렛 ${i}점`));
    }
    const { brands } = extractBrands(pairs.map((p) => p.shop), pairs.map((p) => p.raw));
    // 몰 이름은 선두 토큰이 아니므로 브랜드 목록에 없어야 한다.
    assert.equal(brands.some((b) => b.key === '롯데프리미엄아울렛'), false);
  });

  it('한국어 원제가 없는(한글 괄호 없는) 매장은 미배정', () => {
    const pairs = Array.from({ length: MIN_BRAND_STORES }, (_, i) => ({
      shop: { id: `p${i}`, name: `Plain ${i}`, addr: null, lat: 37, lon: 127, image: null, tel: null, taxRefund: true, brand: null } as Shop,
      raw: { contentid: `p${i}`, title: `Plain ${i} (Hongdae)` } as ShopRaw,
    }));
    const { brandByShopId } = extractBrands(pairs.map((p) => p.shop), pairs.map((p) => p.raw));
    assert.equal(brandByShopId.size, 0);
  });
});
