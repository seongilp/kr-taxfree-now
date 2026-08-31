/**
 * 브랜드 자동 추출. **순수 함수, 하드코딩 브랜드 목록 없음.**
 *
 * 설계 근거(팀 지시): 외국인이 실제로 찾는 건 브랜드다(올리브영이 1급 시민). 하지만 브랜드
 * 목록을 손으로 박으면 데이터가 바뀔 때 거짓말이 된다. 그래서 카탈로그에서 자동으로 뽑되,
 * **애매하면 억지로 분류하지 않는다** — 잘못된 브랜드 묶음은 없느니만 못하다.
 *
 * ── 왜 한국어 원제를 키로 쓰나 ──
 * 같은 매장을 영/일/중간/중번이 서로 다르게 옮긴다("OLIVE YOUNG" vs "欧利芙洋"). 그런데
 * 4개 언어 title 모두 괄호 안에 **동일한 한국어 원제**를 달고 있다(실측). 이 한국어를 브랜드
 * 식별의 언어 독립 키로 삼으면, 언어가 달라도 같은 브랜드가 하나로 묶인다(중간에서 올리브영이
 * "OLIVE YOUNG" 키워드로 0건 나오는 함정도 자동 우회 — 한국어 "올리브영"은 4개 언어 공통).
 *
 * ── 알고리즘(선두 토큰 빈도) ──
 * 매장을 **한국어 이름의 첫 의미 토큰**으로 묶는다("올리브영 강남점" → 올리브영). 그 토큰이
 * 첫 자리에 임계 이상 자주 오면 브랜드로 인정한다. 이렇게 하면 **매장 브랜드와 입점 건물(몰)이
 * 갈린다**: 올리브영·다이소·정관장은 이름 맨 앞에 오지만, "롯데프리미엄아울렛"은 실제 매장
 * ("르꼬끄 롯데…아울렛 김해점")의 중간에만 오므로 첫 토큰이 되지 못한다. 몰 이름으로 서로 다른
 * 브랜드를 뭉치는 잘못된 묶음(팀이 경계한 것)을 구조적으로 막는다. 첫 토큰이 브랜드가 아니면
 * 그 매장은 브랜드 미배정("기타") — 억지로 분류하지 않는다.
 */

import type { Shop, ShopRaw } from './shops';
import { cleanName, koreanOriginal } from './shops';

/** 브랜드 칩을 만들 최소 매장 수. 이보다 적으면 칩을 만들지 않는다(억지 분류 방지). */
export const MIN_BRAND_STORES = 15;

/**
 * 지점·지역·업태 등 브랜드가 아닌 흔한 토큰. 이게 브랜드로 잡히면 서로 다른 브랜드가
 * "명동점"이라는 이름으로 뭉친다 — 정확히 팀이 경계한 잘못된 묶음이다.
 * (완전 일치 토큰만 제거. 부분일치는 하지 않는다 — "롯데백화점"은 살아야 하므로.)
 */
const STOP_TOKENS = new Set([
  // 업태·시설·입점건물(몰·아울렛). 이게 첫 토큰이 되면 서로 다른 브랜드가 건물명으로 뭉친다.
  '백화점', '면세점', '아울렛', '아웃렛', '몰', '지하상가', '상가', '시장', '마트',
  '전문점', '매장', '스토어', '샵', '점', '본점', '지점', '직영점', '플래그십',
  '프리미엄아울렛', '스타필드', '타임스퀘어', '롯데몰', '현대아울렛', '롯데아울렛',
  // 지역(광역·주요 관광지). 브랜드로 오해되기 쉬운 것만.
  '서울', '부산', '대구', '인천', '광주', '대전', '울산', '경기', '제주',
  '명동', '강남', '홍대', '가로수길', '이태원', '동대문', '성수', '잠실', '여의도',
  '수원', '천안', '전주', '청주', '창원', '김해', '경주',
]);

/** 토큰이 지점 접미("…점")로 끝나는가 — 지역+점(예: "명동점")은 브랜드가 아니다. */
function isBranchToken(t: string): boolean {
  return /점$/.test(t) && t.length <= 6;
}

/** 브랜드 후보가 될 수 없는 토큰(불용어·지점명·너무 짧음). */
function isNoise(t: string): boolean {
  if (t.length < 2) return true;
  if (STOP_TOKENS.has(t)) return true;
  if (isBranchToken(t)) return true;
  if (/^\d+$/.test(t)) return true; // 순수 숫자
  return false;
}

/** 한국어 원제 → 의미 토큰 배열(불용어·지점 접미 제거). */
function brandTokens(koreanTitle: string): string[] {
  return koreanTitle
    .split(/[\s,·]+/)
    .map((t) => t.trim())
    .filter((t) => t && !isNoise(t));
}

export interface BrandInfo {
  /** 언어 독립 키(한국어 브랜드 토큰). */
  key: string;
  /** 이 언어에서 보여줄 라벨(현지어 매장명에서 유도). */
  label: string;
  /** 이 브랜드의 매장 수(카탈로그 전체 기준). */
  count: number;
}

/**
 * 라틴/CJK-대상어 이름에서 브랜드 라벨 후보를 뽑는다: 앞쪽의 라틴 단어 1~3개, 또는
 * 라틴이 없으면 앞쪽 CJK 런. 지역/지점 꼬리를 대충 잘라 대표 표기를 만든다.
 */
function labelCandidate(localizedName: string): string {
  let s = localizedName.trim();
  // 지점/지역 꼬리를 자른다: 첫 번째 구분자(스페이스대시·쉼표·괄호) 앞까지가 브랜드 이름.
  // "Olive Young - Gangnam" → "Olive Young", "Nike - Lotte" → "Nike".
  const cut = s.search(/\s[-–—]\s|,|\(|（|\[/);
  if (cut > 0) s = s.slice(0, cut).trim();
  // 라틴 시작이면 라틴 단어 최대 3개(하이픈 포함 상호 유지: ABC-Mart, E-Mart).
  const latin = /^[A-Za-z0-9&'.\-]+(?:\s+[A-Za-z0-9&'.\-]+)*/.exec(s)?.[0]?.trim();
  if (latin && latin.length >= 2) {
    return latin.split(/\s+/).slice(0, 3).join(' ');
  }
  // 아니면 앞쪽 CJK/가나 런(공백 전까지).
  return s.split(/\s+/)[0]?.trim() || s;
}

/**
 * 카탈로그(정규화된 매장 + 원본 title 쌍)로부터 브랜드를 추출한다.
 *  - raws: 원본(한국어 원제 추출용). shops 와 같은 순서/길이여야 한다.
 * 반환: 각 매장에 brandKey 를 배정한 Map 과, 칩으로 쓸 상위 브랜드 목록(count 내림차순).
 */
export function extractBrands(
  shops: Shop[],
  raws: ShopRaw[],
): { brandByShopId: Map<string, string>; brands: BrandInfo[] } {
  // 1) 각 매장의 **선두 의미 토큰**과 그 전역 빈도(첫 자리에 온 횟수).
  const leadById = new Map<string, string | null>();
  const leadFreq = new Map<string, number>();
  for (let i = 0; i < shops.length; i += 1) {
    const shop = shops[i];
    const kr = koreanOriginal(raws[i]?.title);
    const tokens = kr ? brandTokens(kr) : [];
    const lead = tokens[0] ?? null;
    leadById.set(shop.id, lead);
    if (lead) leadFreq.set(lead, (leadFreq.get(lead) ?? 0) + 1);
  }

  // 2) 첫 토큰이 임계 이상 자주 선두에 오면 브랜드.
  const isBrand = (t: string | null): t is string => !!t && (leadFreq.get(t) ?? 0) >= MIN_BRAND_STORES;

  // 3) 각 매장을 선두 브랜드 토큰에 배정(아니면 미배정).
  const brandByShopId = new Map<string, string>();
  const memberNames = new Map<string, string[]>(); // brandKey → 현지어 이름들(라벨 유도용)
  const finalCount = new Map<string, number>();
  for (const shop of shops) {
    const lead = leadById.get(shop.id) ?? null;
    if (!isBrand(lead)) continue;
    brandByShopId.set(shop.id, lead);
    finalCount.set(lead, (finalCount.get(lead) ?? 0) + 1);
    const arr = memberNames.get(lead) ?? [];
    arr.push(shop.name);
    memberNames.set(lead, arr);
  }

  // 4) 브랜드별 대표 라벨(현지어): 멤버 이름의 라벨 후보 중 최빈값.
  const brands: BrandInfo[] = [];
  for (const [key, count] of finalCount) {
    if (count < MIN_BRAND_STORES) continue;
    const names = memberNames.get(key) ?? [];
    const labelFreq = new Map<string, number>();
    for (const n of names) {
      const c = labelCandidate(n);
      if (c) labelFreq.set(c, (labelFreq.get(c) ?? 0) + 1);
    }
    let label = key;
    let max = -1;
    for (const [c, f] of labelFreq) {
      if (f > max) {
        max = f;
        label = c;
      }
    }
    brands.push({ key, label, count });
  }
  brands.sort((a, b) => b.count - a.count);
  return { brandByShopId, brands };
}
