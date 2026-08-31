'use client';

import { MapPin, Store } from 'lucide-react';

import type { ShopWithDistance } from '@/lib/types';
import { dict, type Locale } from '@/lib/i18n';
import { taxRefundBadgeClass, taxRefundLabel } from '@/lib/shop-badge';
import { cn } from '@/lib/utils';

/**
 * 리스트의 한 매장 카드. 거리·택스리펀 여부·주소를 한눈에.
 *
 * 결측을 값인 척 하지 않는다(F-6): 주소가 없으면 주소 줄을 그리지 않고, 위치가 폴백(서울)이면
 * "서울에서 N km" 로 정직하게 표기한다(내 주변인 척하지 않는다).
 */
export function ShopCard({
  shop,
  locale,
  usedFallback,
  selected,
  onSelect,
}: {
  shop: ShopWithDistance;
  locale: Locale;
  usedFallback: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  const d = dict(locale);
  const distance = usedFallback ? d.distanceFromSeoul(shop.distanceKm) : d.distanceAway(shop.distanceKm);
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'flex w-full gap-3 rounded-xl border p-3 text-left transition-colors',
        selected ? 'border-primary bg-accent' : 'border-border bg-card hover:border-muted-foreground/40',
      )}
    >
      {shop.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={shop.image} alt="" loading="lazy" className="size-16 shrink-0 rounded-lg object-cover" />
      ) : (
        <div className="flex size-16 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <Store className="size-5" />
        </div>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-2 text-sm font-semibold leading-snug">{shop.name}</h3>
          <span
            className={cn(
              'shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium',
              taxRefundBadgeClass(shop.taxRefund),
            )}
          >
            {taxRefundLabel(shop.taxRefund, d)}
          </span>
        </div>

        <div className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground">
          <MapPin className="size-3.5 shrink-0" />
          <span className="truncate">
            {distance}
            {shop.addr ? ` · ${shop.addr}` : ''}
          </span>
        </div>
      </div>
    </button>
  );
}
