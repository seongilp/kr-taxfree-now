import type { Shop } from './shops';
import type { BrandInfo } from './brands';

/** API 가 내려주는 매장(정규화 Shop + 서버가 계산한 거리). */
export interface ShopWithDistance extends Shop {
  distanceKm: number;
}

/** /api/shops 응답. */
export interface ShopsResponse {
  shops: ShopWithDistance[];
  brands: BrandInfo[];
  meta: {
    returned: number;
    matched: number;
    total: number;
    usedFallback: boolean;
    truncated: boolean;
  };
}
