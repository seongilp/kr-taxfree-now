/**
 * 쇼핑(택스리펀) 매장 데이터의 정규화. **순수 함수만** 둔다(테스트가 여기에 붙는다).
 *
 * 형제앱(kr-events-now)에서 실제로 터진 두 곳을 그대로 물려받는다:
 *  1) 응답 파서 — 정상/에러 최상위 구조가 통째로 다르다(F-9). 한쪽만 기대하면 조용히 0건.
 *  2) 한글 노출 — 외국어 서비스인데 title/addr 에 한글이 섞여 온다. 외국인에게 못 읽는
 *     한국어를 노출하지 않는다(F-2/F-3). 단, 지도 좌표는 살아 있으므로 핀은 그대로 찍는다.
 *
 * ── 이 앱 고유의 핵심: 택스리펀 태그 ──
 * 관광공사 외국어 쇼핑(contentTypeId=79)의 title 필드에는 언어별로 다른 표기의
 * 택스리펀 태그가 대괄호로 박혀 온다(실측 확인):
 *    영 [Tax Refund Shop] / 일 [事後免税店] / 중간 [事后免税店] / 중번 [事後免稅店]
 * 이 태그가 이 앱이 줄 수 있는 정보의 **상한**이다. 태그는 "여기서 택스리펀 됨"까지만
 * 말한다 — 환급률·즉시/사후 구분·최소구매액은 API 에 없다(그래서 UI 가 절대 계산하지 않는다).
 * 태그가 없는 매장은 "택스리펀 안 됨"이 아니라 "여부 정보 없음"이다. 둘을 구분한다.
 */

/** 언어별 택스리펀 태그(대괄호 포함). 어느 하나라도 title 에 있으면 택스리펀 매장. */
export const TAX_REFUND_TAGS = [
  '[Tax Refund Shop]', // 영
  '[事後免税店]', // 일
  '[事后免税店]', // 중간
  '[事後免稅店]', // 중번
] as const;

/** areaBasedList2 원본 item(우리가 쓰는 필드만). */
export interface ShopRaw {
  contentid?: string;
  contenttypeid?: string;
  title?: string;
  addr1?: string;
  addr2?: string;
  mapx?: string;
  mapy?: string;
  firstimage?: string;
  firstimage2?: string;
  tel?: string;
}

/** 클라이언트로 내보내는 정규화된 매장. 좌표는 숫자. */
export interface Shop {
  id: string;
  /** 표시용 이름(택스리펀 태그·한글 원제 괄호 제거). */
  name: string;
  addr: string | null;
  lat: number;
  lon: number;
  image: string | null;
  tel: string | null;
  /** true=택스리펀 태그 있음, false=태그 없음(=여부 정보 없음, "안 됨"이 아니다). */
  taxRefund: boolean;
  /** 브랜드 키(한국어 원제에서 추출한 언어 독립 식별자). 없으면 null. brands.ts 가 채운다. */
  brand: string | null;
}

/** 한글(자모 포함)이 하나라도 들어 있으면 true. CJK 한자는 제외(중국어 지명을 죽이지 않기 위해). */
export function containsHangul(s: string | undefined | null): boolean {
  return !!s && /[가-힣ㄱ-ㅣ]/.test(s);
}

/** title 에 택스리펀 태그가 있는가. */
export function hasTaxRefundTag(title: string | undefined): boolean {
  if (!title) return false;
  return TAX_REFUND_TAGS.some((t) => title.includes(t));
}

// 반각·전각 소괄호 + CJK 각종 묶음괄호. 관광공사 외국어 title 은 원제(한글)를 이 중
// 아무 괄호로나 뒤에 달아 준다(형제앱 실측: () （） 〈〉 등).
const OPENERS = new Set(['(', '（', '〈', '《', '「', '『', '【']);
const CLOSERS = new Set([')', '）', '〉', '》', '」', '』', '】']);

/**
 * 표시용 이름을 만든다: 택스리펀 태그(대괄호)를 떼고, 맨 뒤의 **한글이 든** 괄호 그룹을 벗긴다.
 *
 * 예) "0914 Flagship Store Dosan Park[Tax Refund Shop](0914 도산공원 플래그십 스토어)"
 *     → "0914 Flagship Store Dosan Park"
 * 한글이 없는 괄호(예: "AK PLAZA (Hongdae)")는 정보이므로 남긴다.
 */
export function cleanName(raw: string | undefined): string {
  if (!raw) return '';
  // 1) 택스리펀 태그(대괄호 표기 전부) 제거.
  let s = raw;
  for (const tag of TAX_REFUND_TAGS) s = s.split(tag).join('');
  s = s.trim();

  // 2) 맨 끝의 균형 잡힌 괄호 그룹을 반복 제거하되, 한글이 든 것만 벗긴다(중첩 포함).
  for (;;) {
    s = s.trimEnd();
    const last = s[s.length - 1];
    if (!last || !CLOSERS.has(last)) break;
    let depth = 0;
    let open = -1;
    for (let i = s.length - 1; i >= 0; i -= 1) {
      const c = s[i];
      if (CLOSERS.has(c)) depth += 1;
      else if (OPENERS.has(c)) {
        depth -= 1;
        if (depth === 0) {
          open = i;
          break;
        }
      }
    }
    if (open === -1) break; // 짝이 안 맞으면 건드리지 않는다
    const group = s.slice(open);
    if (!containsHangul(group)) break; // 한글 없으면 정보 → 남긴다
    s = s.slice(0, open).trim();
  }
  return s || raw.trim();
}

/**
 * 한국어 원제만 뽑는다(괄호 안). 브랜드 추출의 언어 독립 키로 쓴다 —
 * 4개 언어 title 모두 같은 한국어 원제를 괄호로 달고 있어(실측 확인) 언어가 달라도 동일하다.
 * 여러 괄호가 있으면 한글이 든 마지막 괄호 그룹을 취한다. 없으면 빈 문자열.
 */
export function koreanOriginal(raw: string | undefined): string {
  if (!raw) return '';
  let s = raw.trim();
  for (;;) {
    s = s.trimEnd();
    const last = s[s.length - 1];
    if (!last || !CLOSERS.has(last)) break;
    let depth = 0;
    let open = -1;
    for (let i = s.length - 1; i >= 0; i -= 1) {
      const c = s[i];
      if (CLOSERS.has(c)) depth += 1;
      else if (OPENERS.has(c)) {
        depth -= 1;
        if (depth === 0) {
          open = i;
          break;
        }
      }
    }
    if (open === -1) return '';
    const inner = s.slice(open + 1, -1).trim();
    if (containsHangul(inner)) return inner;
    s = s.slice(0, open); // 한글 없는 괄호는 건너뛰고 그 앞을 더 본다
  }
  return '';
}

const numOrNull = (v: string | undefined): number | null => {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

// 한국 대략 경계(WGS84). 좌표가 뒤집혀 오거나(경도/위도 스왑) 0,0 으로 오는 쓰레기를 거른다.
const KR_LON = [124, 132] as const;
const KR_LAT = [33, 39] as const;

/**
 * 원본 item → 정규화 Shop. 좌표가 없거나 한국 밖이면 null(지도에 못 찍는다 = 이 앱의 존재이유).
 * 결측 필드는 비운 채로 둔다 — 절대 한국어/기계번역으로 메우지 않는다(F-2).
 */
export function normalize(raw: ShopRaw): Shop | null {
  const id = raw.contentid?.trim();
  const lon = numOrNull(raw.mapx);
  const lat = numOrNull(raw.mapy);
  if (!id || lat == null || lon == null) return null;
  if (lon < KR_LON[0] || lon > KR_LON[1] || lat < KR_LAT[0] || lat > KR_LAT[1]) return null;

  const name = cleanName(raw.title);
  // 표시 이름이 비거나(괄호가 전부였던 경우) 실질적으로 한국어 상호만 남으면 버린다 —
  // 중국어/일본어 화면에 못 읽는 한국어를 그대로 노출하지 않기 위해서다(F-2).
  // 판정: 한글이 있는데 라틴 문자·가나·한자가 하나도 없으면(숫자·기호만) 미번역 상호로 본다.
  // "Hapa Kristin 올리브영"처럼 라틴/한자가 섞이면 상호의 일부이므로 유지한다.
  const HAS_FOREIGN = /[A-Za-z぀-ヿ㐀-鿿]/; // 라틴 · 히라/가타카나 · CJK 한자
  if (!name || (containsHangul(name) && !HAS_FOREIGN.test(name))) {
    return null;
  }

  const addrJoined = [raw.addr1?.trim(), raw.addr2?.trim()].filter(Boolean).join(' ').trim();
  // 주소에 한글이 섞이면(주로 커버리지가 성긴 번체) 결측으로. 좌표는 살아 지도·길찾기는 된다(F-3).
  const addr = addrJoined && !containsHangul(addrJoined) ? addrJoined : null;

  return {
    id,
    name,
    addr,
    lat,
    lon,
    image: raw.firstimage?.trim() || raw.firstimage2?.trim() || null,
    tel: raw.tel?.trim() || null,
    taxRefund: hasTaxRefundTag(raw.title),
    brand: null, // brands.ts 가 카탈로그 전체를 보고 채운다
  };
}

/**
 * 응답 본문에서 items 배열을 안전하게 뽑는다.
 * 정상: response.body.items.item (배열 또는 단일 객체, 0건이면 items==="").
 * 에러 판정은 parseApiError 가 맡는다(이 함수는 정상 구조만 본다).
 */
export function itemsOf(json: unknown): ShopRaw[] {
  const body = (json as { response?: { body?: { items?: unknown } } })?.response?.body?.items;
  if (!body || body === '') return [];
  const item = (body as { item?: unknown }).item;
  if (Array.isArray(item)) return item as ShopRaw[];
  return item ? [item as ShopRaw] : [];
}

/**
 * 응답이 에러면 { code, msg }, 정상이면 null.
 * 두 자리를 모두 본다: OpenAPI_ServiceResponse.cmmMsgHeader(키/쿼터 계열, 200/403 본문),
 * response.header.resultCode(정상은 "0000"). 200 이 성공이 아니라는 규칙(F-8)을 지킨다.
 */
export function parseApiError(json: unknown): { code: string; msg: string } | null {
  const cmm = (
    json as {
      OpenAPI_ServiceResponse?: { cmmMsgHeader?: { returnReasonCode?: string; errMsg?: string } };
    }
  )?.OpenAPI_ServiceResponse?.cmmMsgHeader;
  if (cmm?.returnReasonCode) {
    return { code: cmm.returnReasonCode, msg: cmm.errMsg ?? 'service error' };
  }
  const header = (json as { response?: { header?: { resultCode?: string; resultMsg?: string } } })
    ?.response?.header;
  if (header?.resultCode && header.resultCode !== '0000') {
    return { code: header.resultCode, msg: header.resultMsg ?? 'service error' };
  }
  return null;
}
