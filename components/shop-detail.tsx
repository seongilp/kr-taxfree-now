'use client';

import { useEffect, useState } from 'react';
import { ExternalLink, Info, MapPin, Navigation, Phone, Store, X } from 'lucide-react';

import type { ShopWithDistance } from '@/lib/types';
import { dict, type Locale } from '@/lib/i18n';
import { taxRefundBadgeClass, taxRefundLabel } from '@/lib/shop-badge';
import { cn } from '@/lib/utils';

interface DetailData {
  overview: string | null;
  homepage: string | null;
  unavailable: boolean;
}

/**
 * 상세 시트. overview 는 열 때 lazy fetch(사용자가 여는 것만 detailCommon2 를 쳐서 쿼터 분산).
 *
 * ★ 택스리펀 정직성(팀 지시): 택스리펀 매장이면 고지문을 반드시 보여준다 — "여기서 택스리펀
 *   됩니다"까지가 한계고 환급률·금액은 계산하지 않는다. 태그 없는 매장은 "여부 정보 없음"이지
 *   "안 됨"이 아니다.
 *
 * overview 세 상태를 서로 다르게(F-6): 로딩 / 있음 / 그 언어로 없음(missing) / 불러오지 못함(unavailable).
 */
export function ShopDetail({
  shop,
  locale,
  usedFallback,
  onClose,
}: {
  shop: ShopWithDistance;
  locale: Locale;
  usedFallback: boolean;
  onClose: () => void;
}) {
  const d = dict(locale);
  const [detail, setDetail] = useState<DetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setDetail(null);
    fetch(`/api/shops/${shop.id}?lang=${locale}`)
      .then((r) => r.json())
      .then((json: DetailData) => {
        if (alive) setDetail(json);
      })
      .catch(() => {
        if (alive) setDetail({ overview: null, homepage: null, unavailable: true });
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [shop.id, locale, reloadKey]);

  // 좌표 기반 길찾기. 주소가 없을 수 있으므로 좌표로 여는 게 가장 안전하다.
  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${shop.lat},${shop.lon}`;
  const distance = usedFallback ? d.distanceFromSeoul(shop.distanceKm) : d.distanceAway(shop.distanceKm);

  return (
    <div className="flex max-h-[75dvh] flex-col overflow-hidden rounded-t-2xl border-t border-border bg-card sm:max-h-[80dvh] sm:rounded-2xl sm:border">
      {/* 헤더 */}
      <div className="flex items-start gap-2 border-b border-border p-4">
        <div className="min-w-0 flex-1">
          <span
            className={cn(
              'mb-1.5 inline-block rounded-full border px-2 py-0.5 text-[11px] font-medium',
              taxRefundBadgeClass(shop.taxRefund),
            )}
          >
            {taxRefundLabel(shop.taxRefund, d)}
          </span>
          <h2 className="text-base font-bold leading-snug">{shop.name}</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={d.close}
          className="shrink-0 rounded-full p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <X className="size-5" />
        </button>
      </div>

      {/* 본문 스크롤 */}
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {shop.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shop.image} alt="" className="h-40 w-full rounded-xl object-cover" loading="lazy" />
        )}

        {/* ★ 택스리펀 고지 — 돈이 걸린 정직성. 환급률·금액을 계산하지 않는다는 천장을 명시. */}
        {shop.taxRefund && (
          <div className="rounded-xl border border-green-500/25 bg-green-500/5 p-3">
            <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-green-400">
              <Info className="size-3.5" />
              {d.taxRefundNoteTitle}
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">{d.taxRefundNote}</p>
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{d.taxRefundGeneralInfo}</p>
          </div>
        )}

        <dl className="space-y-3 text-sm">
          <div className="flex gap-2">
            <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <dt className="text-xs text-muted-foreground">{d.detailAddress}</dt>
              <dd>{shop.addr ?? d.noInfo}</dd>
              <dd className="text-xs text-muted-foreground">{distance}</dd>
            </div>
          </div>

          {shop.tel && (
            <div className="flex gap-2">
              <Phone className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <dt className="text-xs text-muted-foreground">{d.detailTel}</dt>
                <dd className="break-words">{shop.tel}</dd>
              </div>
            </div>
          )}
        </dl>

        {/* overview: 로딩/있음/없음/실패를 구분 */}
        <div>
          <h3 className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Store className="size-3.5" />
            {d.detailAbout}
          </h3>
          {loading ? (
            <p className="text-sm text-muted-foreground">{d.loading}</p>
          ) : detail?.unavailable ? (
            <div className="text-sm">
              <p className="text-muted-foreground">{d.loadFailed}</p>
              <button
                type="button"
                onClick={() => setReloadKey((k) => k + 1)}
                className="mt-1 text-primary underline underline-offset-2"
              >
                {d.retry}
              </button>
            </div>
          ) : detail?.overview ? (
            <p className="whitespace-pre-line text-sm leading-relaxed">{detail.overview}</p>
          ) : (
            // 그 언어로 설명이 없음 — 한국어/기계번역으로 메우지 않는다(F-2).
            <p className="text-sm italic text-muted-foreground">{d.overviewMissing}</p>
          )}
        </div>
      </div>

      {/* 액션 */}
      <div className="flex gap-2 border-t border-border p-3">
        <a
          href={directionsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground"
        >
          <Navigation className="size-4" />
          {d.directions}
        </a>
        {detail?.homepage && (
          <a
            href={detail.homepage}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-medium"
          >
            <ExternalLink className="size-4" />
            {d.detailHomepage}
          </a>
        )}
      </div>
    </div>
  );
}
