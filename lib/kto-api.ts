/**
 * 한국관광공사 TourAPI 외국어 서비스 클라이언트. **서버 전용.** (형제앱 kto-api 의 함정 그대로.)
 *
 * ── 키 인코딩 함정(형제앱들이 반복해 데인 것) ──
 * DATA_GO_KR_KEY(=HORSE) 는 이미 %-인코딩된 Encoding 키다. 쿼리스트링을 **문자열로 직접 조립**하고
 * serviceKey 는 verbatim 으로 이어붙인다. URLSearchParams/params 객체에 넣으면 재인코딩되어
 * (`%2B`→`%252B`) 403 SERVICE_KEY_IS_NOT_REGISTERED 가 난다 — "미구독"과 헷갈려 오진하기 딱 좋다.
 * 키 값은 절대 로그로 출력하지 않는다.
 *
 * ── areaBasedList2 쇼핑(79) 사양(직접 호출로 확인) ──
 *  - contentTypeId=79 (외국어 코드표는 국문과 다르다 — 국문 38 로 부르면 0건 → 결측 오진).
 *  - numOfRows 는 1000 까지 안전(응답 ~0.7MB/페이지). 전국 총 ~11,070건 = 12페이지.
 *  - areaCode 를 붙이면 외국어 서비스에서 0건이 나올 수 있어(외국어 item 의 areacode 결측)
 *    지역 서버필터를 쓰지 않는다. 전량을 받아 좌표로 서버가 공간필터한다.
 *  - detailCommon2 에 overviewYN/addrinfoYN 을 붙이면 v2 에서 resultCode 10. 붙이지 않는다(F-3).
 *
 * ── 실패 처리 ──
 * 200 이 성공이 아니다(F-8). 본문의 returnReasonCode/resultCode 로 판정한다. 실패는 예외로
 * 던지고 **캐시하지 않는다**(F-4). 모든 fetch 에 AbortSignal.timeout(6s).
 */

import { itemsOf, parseApiError, type ShopRaw } from './shops';

const HOST = 'https://apis.data.go.kr/B551011';
const TIMEOUT_MS = 6000;
const PAGE_SIZE = 1000;
/** 안전 상한. 전국 쇼핑은 ~11,070건(12페이지). 폭주 방어로 넉넉히 20 페이지까지만. */
const MAX_PAGES = 20;
const CONTENT_TYPE_SHOPPING = 79;

export class KtoApiFailure extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'KtoApiFailure';
  }
}

function serviceKey(): string {
  const key = process.env.DATA_GO_KR_KEY?.trim() || process.env.HORSE?.trim();
  if (!key) throw new KtoApiFailure('NO_KEY', 'DATA_GO_KR_KEY 가 설정되지 않았습니다.');
  // 이미 %-인코딩된 Encoding 키면 그대로, Decoding 키(% 없음)만 한 번 인코딩한다.
  return key.includes('%') ? key : encodeURIComponent(key);
}

const COMMON = 'MobileOS=ETC&MobileApp=kr-taxfree-now&_type=json';

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const text = await res.text();
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    // 인증 오류는 _type=json 을 줘도 XML 로 떨어진다. 코드만 뽑아 실패로.
    const code = /<returnReasonCode>([^<]*)</.exec(text)?.[1] ?? 'NON_JSON';
    throw new KtoApiFailure(code, `응답 해석 실패: ${text.slice(0, 120)}`);
  }
  const err = parseApiError(json);
  if (err) throw new KtoApiFailure(err.code, err.msg);
  return json;
}

/**
 * 한 서비스(언어)의 전국 쇼핑 매장을 전부 받는다. 페이지를 끝까지 돌아 배열로 합친다.
 * arrange=A(제목순) — 안정 정렬이면 페이지 경계에서 누락/중복이 없다.
 */
export async function fetchShops(service: string): Promise<ShopRaw[]> {
  const key = serviceKey();
  const base =
    `${HOST}/${service}/areaBasedList2?serviceKey=${key}&${COMMON}` +
    `&arrange=A&contentTypeId=${CONTENT_TYPE_SHOPPING}&numOfRows=${PAGE_SIZE}`;

  const first = await fetchJson(`${base}&pageNo=1`);
  const total =
    (first as { response?: { body?: { totalCount?: number } } })?.response?.body?.totalCount ?? 0;
  const acc = itemsOf(first);
  const pages = Math.min(MAX_PAGES, Math.ceil(total / PAGE_SIZE));

  for (let p = 2; p <= pages; p += 1) {
    const json = await fetchJson(`${base}&pageNo=${p}`);
    acc.push(...itemsOf(json));
  }
  return acc;
}

/** detailCommon2 원본(overview 등). v2 라 overviewYN 등 파라미터를 붙이지 않는다(F-3). */
export interface DetailCommonRaw {
  overview?: string;
  homepage?: string;
  tel?: string;
  addr1?: string;
  title?: string;
}

export async function fetchDetailCommon(
  service: string,
  contentId: string,
): Promise<DetailCommonRaw | null> {
  const url =
    `${HOST}/${service}/detailCommon2?serviceKey=${serviceKey()}&${COMMON}` +
    `&contentId=${encodeURIComponent(contentId)}`;
  const json = await fetchJson(url);
  return (itemsOf(json)[0] as DetailCommonRaw | undefined) ?? null;
}
