/**
 * 업스트림 보호 캐시(모듈 스코프 메모리 + inflight). 이 앱 쿼터 방어의 핵심이다.
 *
 * 왜 필수인가(팀 지시): 카탈로그는 11,070건이고 언어가 4개다. 오퍼레이션당 1,000회/일 한도에서
 * **언어당 하루 1회 전량 수집**(12페이지)만 하면 48콜/일 — 여유가 크다. 반대로 사용자 위치가
 * 바뀔 때마다 반경 API(locationBasedList2)를 때리면 쿼터가 사용자 수에 비례해 터진다. 그래서
 * 전량을 한 번 받아 캐시하고, "내 주변"은 캐시된 전량에서 서버가 좌표로 골라 낸다(업스트림 0).
 *
 * 규칙:
 *  - 성공만 캐시한다. 쿼터·타임아웃 실패는 예외로 그대로 던진다(호출부가 no-store 응답).
 *  - **TTL 을 KST 자정에서 자른다.** 캐시 키에도 KST 날짜를 넣어 이중 안전.
 *  - Vercel 인스턴스는 언제든 새로 뜨므로 이 메모리 캐시는 웜 인스턴스 안에서의 최선이다.
 *    첫 요청(콜드)은 12페이지 수집으로 느릴 수 있으나, 이후 모든 사용자가 캐시를 공유한다.
 */

import { fetchDetailCommon, fetchShops, type DetailCommonRaw } from './kto-api';
import { normalize, type Shop, type ShopRaw } from './shops';
import { extractBrands, type BrandInfo } from './brands';
import { msUntilKstMidnight, todayYmdKst } from './kst';

/** 한 언어의 전량 카탈로그(정규화 + 브랜드 배정 완료). */
export interface Catalog {
  shops: Shop[];
  /** 칩으로 쓸 상위 브랜드(count 내림차순). */
  brands: BrandInfo[];
}

interface CatalogEntry {
  expiresAt: number;
  catalog: Catalog;
}

const catalogCache = new Map<string, CatalogEntry>();
const catalogInflight = new Map<string, Promise<Catalog>>();

/** 원본 배열 → 정규화 + 브랜드 배정된 Catalog. 순수 조립(테스트 가능). */
export function buildCatalog(raws: ShopRaw[]): Catalog {
  const shops: Shop[] = [];
  const keptRaws: ShopRaw[] = [];
  for (const r of raws) {
    const s = normalize(r);
    if (s) {
      shops.push(s);
      keptRaws.push(r);
    }
  }
  const { brandByShopId, brands } = extractBrands(shops, keptRaws);
  // 각 매장에 브랜드 키를 불변 갱신으로 박는다(원본 mutate 금지).
  const withBrand = shops.map((s) => ({ ...s, brand: brandByShopId.get(s.id) ?? null }));
  return { shops: withBrand, brands };
}

/**
 * 한 서비스(언어)의 전량 카탈로그. 성공 시 KST 자정까지 캐시. inflight 로 동시요청 합류.
 */
export async function getCatalogCached(service: string): Promise<Catalog> {
  const today = todayYmdKst();
  const key = `${service}:${today}`;

  const hit = catalogCache.get(key);
  if (hit && Date.now() < hit.expiresAt) return hit.catalog;

  const pending = catalogInflight.get(key);
  if (pending) return pending;

  const p = fetchShops(service)
    .then((raws) => {
      const catalog = buildCatalog(raws);
      catalogCache.set(key, { expiresAt: Date.now() + msUntilKstMidnight(), catalog });
      for (const k of catalogCache.keys()) {
        if (!k.endsWith(`:${today}`)) catalogCache.delete(k); // 어제 키 청소
      }
      return catalog;
    })
    .finally(() => {
      catalogInflight.delete(key); // 실패든 성공이든 inflight 비움(실패 재시도 가능)
    });

  catalogInflight.set(key, p);
  return p;
}

interface DetailEntry {
  at: number;
  value: DetailCommonRaw | null;
}

const DETAIL_TTL_MS = 12 * 60 * 60 * 1000;
const DETAIL_MAX = 2000;
const detailCache = new Map<string, DetailEntry>();
const detailInflight = new Map<string, Promise<DetailCommonRaw | null>>();

/** 상세 조회(캐시). 성공만 캐시(null=레코드 없음도 유효한 답이라 캐시). 실패는 던진다. */
export async function getDetailCached(
  service: string,
  contentId: string,
): Promise<DetailCommonRaw | null> {
  const key = `${service}:${contentId}`;
  const hit = detailCache.get(key);
  if (hit && Date.now() - hit.at < DETAIL_TTL_MS) return hit.value;

  const pending = detailInflight.get(key);
  if (pending) return pending;

  const p = fetchDetailCommon(service, contentId)
    .then((value) => {
      detailCache.set(key, { at: Date.now(), value });
      if (detailCache.size > DETAIL_MAX) {
        const oldest = detailCache.keys().next().value;
        if (oldest !== undefined) detailCache.delete(oldest);
      }
      return value;
    })
    .finally(() => {
      detailInflight.delete(key);
    });

  detailInflight.set(key, p);
  return p;
}
