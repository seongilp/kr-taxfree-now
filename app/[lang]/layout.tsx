import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';
import { Noto_Sans } from 'next/font/google';

import '../globals.css';
import {
  DICT,
  HTML_LANG,
  LOCALES,
  isLocale,
  type Locale,
} from '@/lib/i18n';

/**
 * 로케일 루트 레이아웃. `[lang]` 세그먼트가 최상위이므로 이 레이아웃이 html/body 를 그린다
 * (경로 없는 `/` 는 middleware 가 로케일로 리다이렉트한다).
 *
 * `<html lang>` 을 로케일별로 정확히 박아야 스크린리더·검색엔진이 언어를 안다. 다크모드
 * 기본(`class="dark"`)은 형제앱과 동일. 폰트는 라틴+CJK 를 모두 무난히 그리는 Noto Sans.
 */
const notoSans = Noto_Sans({
  variable: '--font-sans',
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  display: 'swap',
});

const SITE = 'https://kr-taxfree-now.vercel.app';

export function generateStaticParams() {
  return LOCALES.map((lang) => ({ lang }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const d = DICT[lang];
  // hreflang: 각 로케일 대체 URL + x-default. 검색엔진이 방문자 언어에 맞는 페이지를 고른다.
  const languages: Record<string, string> = { 'x-default': `${SITE}/en` };
  for (const l of LOCALES) languages[HTML_LANG[l]] = `${SITE}/${l}`;

  return {
    metadataBase: new URL(SITE),
    title: `${d.appName} — ${d.tagline}`,
    description: d.heroSubtitle,
    alternates: { canonical: `${SITE}/${lang}`, languages },
    openGraph: {
      title: `${d.appName} — ${d.tagline}`,
      description: d.heroSubtitle,
      url: `${SITE}/${lang}`,
      siteName: d.appName,
      locale: HTML_LANG[lang].replace('-', '_'),
      type: 'website',
    },
  };
}

export const viewport: Viewport = {
  themeColor: '#0b0f19',
  width: 'device-width',
  initialScale: 1,
  // 지도 앱이라 사용자 확대는 허용하되 초기 배율만 고정.
  maximumScale: 5,
};

export default async function LangLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const locale = lang as Locale;

  return (
    <html
      lang={HTML_LANG[locale]}
      className={`dark ${notoSans.variable} antialiased`}
      suppressHydrationWarning
    >
      <body className="bg-background text-foreground min-h-dvh">{children}</body>
    </html>
  );
}
