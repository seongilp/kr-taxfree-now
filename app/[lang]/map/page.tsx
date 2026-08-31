import { notFound } from 'next/navigation';

import { isLocale, type Locale } from '@/lib/i18n';
import { ShopsBrowser } from '@/components/shops-browser';

/**
 * 앱 본체. 지도가 첫 화면. 위치·필터는 클라이언트에서, 공간 필터는 서버가 한다
 * (11,070건을 통째로 내리지 않고 서버가 가까운 ≤200건만 골라 준다).
 */
export default async function MapPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return <ShopsBrowser locale={lang as Locale} />;
}
