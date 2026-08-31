import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BadgeCheck, MapPin, Navigation, ShoppingBag } from 'lucide-react';

import { dict, isLocale, LOCALES, LOCALE_LABEL, type Locale } from '@/lib/i18n';
import { buttonVariants } from '@/components/ui/button';

/**
 * 랜딩 페이지(서버 컴포넌트). 니치를 한 문장으로 세우고 지도로 보낸다.
 * SEO 를 위해 실제 설명 텍스트를 서버에서 렌더한다 — 지도 앱 본체는 클라이언트라 크롤러가
 * 못 읽으므로, 이 페이지가 언어별 색인의 근거가 된다.
 */
export default async function Landing({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const locale = lang as Locale;
  const d = dict(locale);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col px-5 py-10">
      {/* 언어 스위처 */}
      <nav className="mb-10 flex flex-wrap gap-2" aria-label={d.langLabel}>
        {LOCALES.map((l) => (
          <Link
            key={l}
            href={`/${l}`}
            className={`rounded-full border px-3 py-1 text-xs transition-colors ${
              l === locale
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            {LOCALE_LABEL[l]}
          </Link>
        ))}
      </nav>

      <div className="flex flex-1 flex-col justify-center">
        <div className="mb-3 inline-flex w-fit items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
          <BadgeCheck className="size-3.5 text-green-400" />
          {d.tagline}
        </div>

        <h1 className="text-3xl font-bold leading-tight tracking-tight sm:text-4xl">{d.heroTitle}</h1>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground">{d.heroSubtitle}</p>

        <div className="mt-8">
          <Link
            href={`/${locale}/map`}
            className={buttonVariants({ size: 'lg', className: 'h-12 w-full gap-2 text-base sm:w-auto sm:px-8' })}
          >
            <Navigation className="size-4" />
            {d.openMap}
          </Link>
        </div>

        <ul className="mt-12 space-y-4 text-sm">
          <li className="flex items-start gap-3">
            <BadgeCheck className="mt-0.5 size-5 shrink-0 text-green-400" />
            <span className="text-muted-foreground">{d.taxRefundYes} · {d.filterTaxRefundOnly}</span>
          </li>
          <li className="flex items-start gap-3">
            <ShoppingBag className="mt-0.5 size-5 shrink-0 text-primary" />
            <span className="text-muted-foreground">{d.brandLabel}: Olive Young · {d.filterAllBrands}</span>
          </li>
          <li className="flex items-start gap-3">
            <MapPin className="mt-0.5 size-5 shrink-0 text-primary" />
            <span className="text-muted-foreground">{d.nearbyShops} · {d.sortByDistance}</span>
          </li>
        </ul>

        {/* 택스리펀 고지를 랜딩에도 짧게 — 정직성은 첫 화면부터. */}
        <p className="mt-8 rounded-lg border border-border bg-card/50 p-3 text-xs leading-relaxed text-muted-foreground">
          {d.taxRefundNote}
        </p>
      </div>

      <footer className="mt-10 border-t border-border pt-4 text-xs text-muted-foreground">{d.dataSource}</footer>
    </main>
  );
}
