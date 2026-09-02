'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, BadgeCheck, Loader2, MapPin, ShoppingBag } from 'lucide-react';

import type { LatLon } from '@/lib/geo';
import { MYEONGDONG } from '@/lib/geo';
import type { BrandInfo } from '@/lib/brands';
import type { ShopWithDistance, ShopsResponse } from '@/lib/types';
import { dict, LOCALES, LOCALE_LABEL, type Locale } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { ShopCard } from '@/components/shop-card';
import { ShopDetail } from '@/components/shop-detail';
import { ShopsMap, type MapPoint } from '@/components/shops-map';

/** 위치 상태를 명확히 구분(무한 로딩 금지, F-6). */
type GeoState =
  | { kind: 'locating' }
  | { kind: 'granted'; at: LatLon }
  | { kind: 'denied' }
  | { kind: 'unavailable' }
  | { kind: 'unsupported' };

/** 데이터 로딩 상태. "0건"·"로딩중"·"실패"를 절대 섞지 않는다(F-6). */
type DataState =
  | { kind: 'loading' }
  | { kind: 'error'; code?: string }
  | { kind: 'ready'; data: ShopsResponse };

export function ShopsBrowser({ locale }: { locale: Locale }) {
  const d = dict(locale);
  const [data, setData] = useState<DataState>({ kind: 'loading' });
  const [geo, setGeo] = useState<GeoState>({ kind: 'locating' });
  const [taxRefundOnly, setTaxRefundOnly] = useState(true);
  const [brand, setBrand] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // 브랜드 칩은 첫 응답의 것으로 고정(필터를 바꿔도 칩 목록이 흔들리지 않게).
  const [brands, setBrands] = useState<BrandInfo[]>([]);

  const hasRealLocation = geo.kind === 'granted';
  const origin: LatLon = geo.kind === 'granted' ? geo.at : MYEONGDONG;

  /* 위치. map 화면 진입은 "내 주변"을 보겠다는 의도라 한 번 요청.
     거부/불가/미지원을 각각 다른 상태로 두고, 어느 경우든 서울로 폴백해 계속 동작한다. */
  useEffect(() => {
    if (!('geolocation' in navigator)) {
      setGeo({ kind: 'unsupported' });
      return;
    }
    let alive = true;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (alive) setGeo({ kind: 'granted', at: { lat: pos.coords.latitude, lon: pos.coords.longitude } });
      },
      (err) => {
        if (!alive) return;
        setGeo({ kind: err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable' });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
    return () => {
      alive = false;
    };
  }, []);

  const requestLocation = () => {
    setGeo({ kind: 'locating' });
    navigator.geolocation.getCurrentPosition(
      (pos) => setGeo({ kind: 'granted', at: { lat: pos.coords.latitude, lon: pos.coords.longitude } }),
      (err) => setGeo({ kind: err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable' }),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  /* 데이터 로드. 서버가 공간 필터를 하므로, 위치/필터가 바뀔 때 재요청한다(업스트림은 캐시라 0).
     위치가 아직 locating 이면 기다린다 — 서울 결과를 잠깐 보였다가 튀는 걸 막는다. */
  const load = useCallback(() => {
    // 위치 확정 전에는 로드하지 않는다(폴백은 확정된 '거부/불가/미지원'에서만).
    if (geo.kind === 'locating') return;
    let alive = true;
    setData({ kind: 'loading' });
    const params = new URLSearchParams({ lang: locale, taxRefundOnly: taxRefundOnly ? '1' : '0' });
    if (hasRealLocation) {
      params.set('lat', String(origin.lat));
      params.set('lon', String(origin.lon));
    }
    if (brand) params.set('brand', brand);

    fetch(`/api/shops?${params.toString()}`)
      .then(async (r) => {
        if (!r.ok) {
          const body = (await r.json().catch(() => ({}))) as { code?: string };
          throw Object.assign(new Error('upstream'), { code: body.code });
        }
        return r.json() as Promise<ShopsResponse>;
      })
      .then((json) => {
        if (!alive) return;
        setData({ kind: 'ready', data: json });
        // 브랜드 칩은 한 번만 채운다(전량 기준이라 필터와 무관하게 안정적).
        setBrands((prev) => (prev.length ? prev : json.brands));
      })
      .catch((e: { code?: string }) => {
        if (alive) setData({ kind: 'error', code: e?.code });
      });
    return () => {
      alive = false;
    };
    // origin 좌표는 hasRealLocation 이 true 일 때만 쿼리에 들어가므로 의존에 lat/lon 포함.
  }, [locale, taxRefundOnly, brand, hasRealLocation, origin.lat, origin.lon, geo.kind]);

  useEffect(() => {
    const cleanup = load();
    return cleanup;
  }, [load]);

  const shops: ShopWithDistance[] = data.kind === 'ready' ? data.data.shops : [];
  const meta = data.kind === 'ready' ? data.data.meta : null;
  const usedFallback = meta?.usedFallback ?? !hasRealLocation;

  const points: MapPoint[] = useMemo(
    () => shops.map((s) => ({ id: s.id, lon: s.lon, lat: s.lat, taxRefund: s.taxRefund, title: s.name })),
    [shops],
  );

  const selected = shops.find((s) => s.id === selectedId) ?? null;
  // 지도 중심: origin 이 실제 위치(granted) 또는 명동(폴백)으로 이미 정해져 있다.
  // 파란 '내 위치' 점은 실제 위치일 때만(명동을 내 위치인 척하지 않는다).
  const center = origin;

  return (
    <div className="flex h-dvh flex-col">
      {/* 상단 바: 로고 + 언어 스위처 */}
      <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-2.5">
        <Link href={`/${locale}`} className="flex items-center gap-2 text-sm font-bold">
          <ShoppingBag className="size-4 text-primary" />
          {d.appName}
        </Link>
        <nav className="flex gap-1" aria-label={d.langLabel}>
          {LOCALES.map((l) => (
            <Link
              key={l}
              href={`/${l}/map`}
              className={cn(
                'rounded-full px-2 py-1 text-[11px] transition-colors',
                l === locale ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {LOCALE_LABEL[l]}
            </Link>
          ))}
        </nav>
      </header>

      {/* 필터: 택스리펀 토글 + 브랜드 칩(가로 스크롤). 올리브영이 count 최대라 자동으로 맨 앞. */}
      <div className="flex items-center gap-2 border-b border-border px-4 py-2">
        <button
          type="button"
          onClick={() => setTaxRefundOnly((v) => !v)}
          aria-pressed={taxRefundOnly}
          className={cn(
            'flex shrink-0 items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition-colors',
            taxRefundOnly
              ? 'border-green-500/40 bg-green-500/15 text-green-400'
              : 'border-border text-muted-foreground hover:text-foreground',
          )}
        >
          <BadgeCheck className="size-3.5" />
          {d.filterTaxRefundOnly}
        </button>

        <div className="scrollbar-none flex gap-1.5 overflow-x-auto">
          <button
            type="button"
            onClick={() => setBrand(null)}
            className={cn(
              'shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors',
              brand === null
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border text-muted-foreground hover:text-foreground',
            )}
          >
            {d.filterAllBrands}
          </button>
          {brands.map((b) => (
            <button
              key={b.key}
              type="button"
              onClick={() => setBrand((cur) => (cur === b.key ? null : b.key))}
              className={cn(
                'shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                brand === b.key
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border text-muted-foreground hover:text-foreground',
              )}
            >
              {b.label}
              <span className="ml-1 opacity-60">{b.count}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 위치 상태 배너: 폴백/거부/불가를 명확히. granted 면 배너 없음. */}
      {geo.kind !== 'granted' && geo.kind !== 'locating' && (
        <div className="flex items-center gap-2 border-b border-border bg-amber-500/10 px-4 py-2 text-xs text-amber-300">
          <MapPin className="size-3.5 shrink-0" />
          <span className="flex-1">{geo.kind === 'denied' ? d.locationDenied : d.locationUnavailable}</span>
          {geo.kind !== 'unsupported' && (
            <button
              type="button"
              onClick={requestLocation}
              className="shrink-0 rounded-full border border-amber-400/40 px-2 py-0.5 font-medium hover:bg-amber-400/10"
            >
              {d.useMyLocation}
            </button>
          )}
        </div>
      )}

      {/* 지도가 첫 화면: 위쪽에 크게. 리스트는 그 아래. 데스크톱은 좌우 분할. */}
      <div className="flex min-h-0 flex-1 flex-col sm:flex-row-reverse">
        {/* 지도 */}
        <div className="relative h-[45dvh] w-full shrink-0 sm:h-auto sm:flex-1">
          {(data.kind === 'ready' || (data.kind === 'loading' && shops.length > 0)) && (
            <ShopsMap points={points} center={center} isUserLocation={hasRealLocation} selectedId={selectedId} onSelect={setSelectedId} />
          )}
          {data.kind === 'loading' && shops.length === 0 && (
            <div className="flex size-full items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              {geo.kind === 'locating' ? d.locating : d.loading}
            </div>
          )}
          {data.kind === 'error' && (
            <div className="flex size-full flex-col items-center justify-center gap-2 p-6 text-center text-sm">
              <AlertCircle className="size-6 text-destructive" />
              <p className="text-muted-foreground">{d.loadFailed}</p>
              <button
                type="button"
                onClick={() => load()}
                className="rounded-full border border-border px-3 py-1 text-xs hover:bg-accent"
              >
                {d.retry}
              </button>
            </div>
          )}
        </div>

        {/* 리스트 */}
        <div className="flex min-h-0 flex-1 flex-col sm:w-96 sm:flex-none sm:border-r sm:border-border">
          <div className="flex items-baseline justify-between px-4 py-2 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{d.nearbyShops}</span>
            {data.kind === 'ready' && (
              <span>
                {d.shopsCount(shops.length)}
                {hasRealLocation ? ` · ${d.sortByDistance}` : ` · ${d.locationFallback}`}
              </span>
            )}
          </div>

          {/* 잘림 안내: matched 가 returned 보다 크면 "가장 가까운 N건만" 임을 정직하게 알린다. */}
          {data.kind === 'ready' && meta?.truncated && (
            <p className="px-4 pb-1 text-[11px] text-muted-foreground">{d.moreInArea(shops.length)}</p>
          )}

          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 pb-4">
            {data.kind === 'ready' && shops.length === 0 && (
              <div className="flex flex-col items-center gap-2 py-12 text-center">
                <ShoppingBag className="size-8 text-muted-foreground/50" />
                <p className="text-sm font-medium">{d.emptyNearby}</p>
                <p className="text-xs text-muted-foreground">{d.emptyNearbyHint}</p>
              </div>
            )}
            {shops.map((s) => (
              <ShopCard
                key={s.id}
                shop={s}
                locale={locale}
                usedFallback={usedFallback}
                selected={s.id === selectedId}
                onSelect={() => setSelectedId(s.id)}
              />
            ))}
            {data.kind === 'loading' &&
              shops.length === 0 &&
              geo.kind !== 'locating' &&
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-[88px] animate-pulse rounded-xl bg-muted" />
              ))}
          </div>
        </div>
      </div>

      {/* 상세 시트 */}
      {selected && (
        <div className="fixed inset-x-0 bottom-0 z-20 sm:inset-auto sm:bottom-4 sm:right-4 sm:w-96">
          <ShopDetail shop={selected} locale={locale} usedFallback={usedFallback} onClose={() => setSelectedId(null)} />
        </div>
      )}
    </div>
  );
}
