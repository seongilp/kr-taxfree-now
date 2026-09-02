import { NextResponse } from 'next/server';

import { getCatalogCached } from '@/lib/kto-cache';
import { isLocale, SERVICE_BY_LOCALE } from '@/lib/i18n';
import { nearest, MYEONGDONG, type LatLon } from '@/lib/geo';
import { swrCacheControl } from '@/lib/cache-control';

/**
 * ★ 이 앱의 심장: 서버 공간 필터.
 *
 * 카탈로그(언어당 11,070건)를 통째로 클라이언트에 내리지 않는다(로밍 사망). 대신 서버가
 * 전량을 캐시(언어당 하루 1회 업스트림)하고, 요청 좌표 기준으로 가까운 N건만 골라 내린다.
 * 위치가 바뀌어도 업스트림은 0 — 캐시된 전량에서 다시 고를 뿐이다.
 *
 * 쿼리: lang(필수), lat/lon(없으면 명동 폴백), brand(브랜드 키), taxRefundOnly(1/0).
 * 응답: shops(가까운 순 ≤LIMIT, 거리 포함), brands(칩용 상위 브랜드), meta.
 *
 * 캐시(두 갈래):
 *  - **좌표 없는 요청(명동 폴백)**: 응답이 lang+필터에만 의존해 전 사용자가 동일 → CDN 이
 *    캐시 가능. s-maxage + stale-while-revalidate 로 콜드도 즉시 응답(느린 첫 로딩 해소).
 *    이게 위치 거부 사용자(흔함)의 느림을 없애는 1순위 수정이다.
 *  - **좌표 있는 요청(실제 위치)**: 좌표마다 응답이 달라 CDN 이 안 먹으므로 no-store.
 *    대신 카탈로그가 인스턴스 간 공유 Data Cache 라(kto-api) 콜드도 빠르다(4.5s→~).
 *  업스트림 보호는 모듈 캐시 + Data Cache 가 한다.
 */

const LIMIT = 200; // 클라이언트로 내리는 최대 건수(payload ~30KB). 지도·리스트가 감당할 상한.

function parseCoord(v: string | null, lo: number, hi: number): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < lo || n > hi) return null;
  return n;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const lang = searchParams.get('lang') ?? '';
  if (!isLocale(lang)) {
    return NextResponse.json({ error: 'invalid lang' }, { status: 400 });
  }

  // 좌표 검증(경도 124~132, 위도 33~39 = 한국 근방). 없거나 이상하면 서울 폴백.
  const lat = parseCoord(searchParams.get('lat'), 33, 39);
  const lon = parseCoord(searchParams.get('lon'), 124, 132);
  const origin: LatLon = lat != null && lon != null ? { lat, lon } : MYEONGDONG;
  const usedFallback = lat == null || lon == null;

  const brand = searchParams.get('brand')?.trim() || null;
  // 기본은 택스리펀만(이 앱의 존재이유). 명시적으로 0 을 줄 때만 전체.
  const taxRefundOnly = searchParams.get('taxRefundOnly') !== '0';

  try {
    const catalog = await getCatalogCached(SERVICE_BY_LOCALE[lang]);

    let pool = catalog.shops;
    if (taxRefundOnly) pool = pool.filter((s) => s.taxRefund);
    if (brand) pool = pool.filter((s) => s.brand === brand);

    const ranked = nearest(pool, origin, LIMIT);
    const shops = ranked.map((r) => ({ ...r.item, distanceKm: Math.round(r.distanceKm * 10) / 10 }));

    return NextResponse.json(
      {
        shops,
        // 칩은 전량 기준 상위 브랜드(현 필터의 위치와 무관하게 안정적). 상위 12개만.
        brands: catalog.brands.slice(0, 12),
        meta: {
          returned: shops.length,
          matched: pool.length,
          total: catalog.shops.length,
          usedFallback,
          truncated: pool.length > shops.length,
        },
      },
      {
        headers: {
          // 좌표 없는 폴백 응답만 CDN 캐시(전 사용자 동일). 실좌표는 사용자마다 달라 no-store.
          'Cache-Control': usedFallback ? swrCacheControl(3600) : 'no-store',
        },
      },
    );
  } catch (e) {
    // "결측"이 아니라 "지금 불러오지 못함"으로 구분(F-6). 캐시 금지.
    const code = e instanceof Error && 'code' in e ? (e as { code: string }).code : 'ERROR';
    return NextResponse.json(
      { error: 'upstream', code },
      { status: 502, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
