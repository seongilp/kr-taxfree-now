/**
 * 지리 계산 + 공간 필터. 좌표는 전부 WGS84(mapx=경도, mapy=위도) — 관광공사 API 가 직접 준다.
 *
 * ★ 이 앱의 최대 설계 난제(팀 지시): 카탈로그가 11,070건 × 4개 언어다. 형제앱(축제 70건)처럼
 *   통째로 클라이언트에 내리면 모바일·로밍에서 죽는다. 그래서 **서버가 공간 필터**를 한다 —
 *   전량을 서버 메모리에 캐시(위치 무관, 언어당 하루 1회 업스트림)하고, 요청 좌표 기준으로
 *   가까운 N건만 골라 내린다. 여기 nearest() 가 그 심장이다. 순수 함수라 테스트가 붙는다.
 */

const EARTH_RADIUS_KM = 6371;

export interface LatLon {
  lat: number;
  lon: number;
}

/**
 * 명동. 위치 권한이 없거나 거부됐을 때의 폴백 중심.
 * 외국인 관광객 앱이라 서울시청보다 명동이 더 맞다(면세·쇼핑 밀집지).
 * 폴백임을 화면에 정직하게 밝힌다(usedFallback → '명동 기준').
 */
export const MYEONGDONG: LatLon = { lat: 37.5636, lon: 126.9827 };

const toRad = (deg: number) => (deg * Math.PI) / 180;

/** 두 좌표 사이 대권 거리(km). 하버사인. */
export function haversineKm(a: LatLon, b: LatLon): number {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** 위경도를 가진 임의 항목. */
export interface Located {
  lat: number;
  lon: number;
}

export interface WithDistance<T> {
  item: T;
  distanceKm: number;
}

/**
 * origin 에서 가까운 순으로 최대 limit 개를 고른다. 각 항목에 거리(km)를 붙여 반환한다.
 * maxKm 를 주면 그 반경 밖은 버린다(내 주변이 텅 빈 지방이면 전국을 긁어오지 않게).
 *
 * 왜 서버에서 도나: 11,070건 전체에 하버사인을 돌려도 수 밀리초다. 반대로 이걸 클라이언트로
 * 미루려면 11,070건을 네트워크로 내려야 한다 — 그게 이 앱이 절대 피해야 할 것(로밍 사망).
 */
export function nearest<T extends Located>(
  items: readonly T[],
  origin: LatLon,
  limit: number,
  maxKm?: number,
): WithDistance<T>[] {
  const scored: WithDistance<T>[] = [];
  for (const item of items) {
    const distanceKm = haversineKm(origin, { lat: item.lat, lon: item.lon });
    if (maxKm != null && distanceKm > maxKm) continue;
    scored.push({ item, distanceKm });
  }
  scored.sort((a, b) => a.distanceKm - b.distanceKm);
  return scored.slice(0, limit);
}
