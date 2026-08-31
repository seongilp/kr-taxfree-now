/**
 * KST 달력 날짜 계산. (형제앱 ipyang/lib/kst.ts 의 패턴을 축제 앱에 맞춰 옮긴 것.)
 *
 * 왜 따로 두는가: 이 앱의 핵심 값은 "축제가 오늘 기준 진행중인가/며칠 남았나"다. 이걸
 * **인스턴트(시각 Date)와 달력 날짜를 섞어** 계산하면 자정 경계에서 하루씩 밀린다 —
 * 항공/입양 앱에서 실제로 두 번 터진 결함이다. 그래서 여기서는 양쪽 모두
 * **KST 달력 날짜 → 에폭 일수(정수)** 로 바꾼 뒤 정수끼리만 뺀다. 기준이 하나뿐이라
 * 한쪽만 고쳐서 다시 어긋날 여지가 없다.
 *
 * 그리고 캐시 TTL 을 KST 자정에서 잘라(msUntilKstMidnight) "이번 주말" 필터가
 * 날짜 경계를 넘겨 하루 틀린 캐시를 재사용하는 일을 구조적으로 막는다.
 */

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 86_400_000;

/** 지금이 KST 로 며칠인지, 1970-01-01 을 0 으로 세는 정수. */
export function kstToday(nowMs: number = Date.now()): number {
  return Math.floor((nowMs + KST_OFFSET_MS) / DAY_MS);
}

/**
 * `20260901` → 에폭 일수. 형식이 어긋나거나 존재하지 않는 날짜면 null.
 *
 * 자릿수만 보고 넘기면 `20260231` 같은 값이 3월 3일로 조용히 굴러간다.
 * 되돌려 비교해 실제로 있는 날짜인지 확인한다.
 */
export function ymdToDay(value: string | undefined | null): number | null {
  if (!value || !/^\d{8}$/.test(value)) return null;
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(4, 6));
  const day = Number(value.slice(6, 8));
  const ms = Date.UTC(year, month - 1, day);
  if (Number.isNaN(ms)) return null;
  const back = new Date(ms);
  if (
    back.getUTCFullYear() !== year ||
    back.getUTCMonth() !== month - 1 ||
    back.getUTCDate() !== day
  ) {
    return null;
  }
  return ms / DAY_MS;
}

/** 에폭 일수 → `20260901`. */
export function dayToYmd(day: number): string {
  const date = new Date(day * DAY_MS);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}`;
}

/** KST 기준 오늘 `YYYYMMDD`. 서버가 UTC 로 도므로 직접 보정한다. */
export function todayYmdKst(nowMs: number = Date.now()): string {
  return dayToYmd(kstToday(nowMs));
}

/**
 * 다음 KST 자정까지 남은 밀리초. 자정 정각이면 꼬박 하루(86,400,000).
 * 캐시 수명을 이 값으로 잘라 두면, 날짜 경계를 넘겨 "이번 주말" 판정이 하루 틀린
 * 캐시를 재사용하는 일이 구조적으로 불가능해진다.
 */
export function msUntilKstMidnight(nowMs: number = Date.now()): number {
  return (kstToday(nowMs) + 1) * DAY_MS - KST_OFFSET_MS - nowMs;
}
