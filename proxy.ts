import { NextRequest, NextResponse } from 'next/server';

import { DEFAULT_LOCALE, LOCALES, type Locale } from '@/lib/i18n';

/**
 * 로케일 프리픽스가 없는 경로(`/`, `/map` 등)를 방문자 언어로 리다이렉트한다.
 * 대상은 외국인이라 한국어 UI 가 없으므로, Accept-Language 를 협상해 가장 가까운
 * 4개 로케일 중 하나로 보낸다(협상 실패 시 영어).
 *
 * 이미 로케일로 시작하거나 정적/에셋 경로면 통과시킨다.
 */
function negotiate(header: string | null): Locale {
  if (!header) return DEFAULT_LOCALE;
  // "zh-TW,zh;q=0.9,en;q=0.8" 같은 헤더를 앞에서부터 훑는다.
  const parts = header
    .split(',')
    .map((p) => p.split(';')[0].trim().toLowerCase())
    .filter(Boolean);
  for (const p of parts) {
    if (p === 'zh-tw' || p === 'zh-hant' || p === 'zh-hk' || p === 'zh-mo') return 'zh-TW';
    if (p.startsWith('zh')) return 'zh-CN'; // zh, zh-cn, zh-hans, zh-sg → 간체
    if (p.startsWith('ja')) return 'ja';
    if (p.startsWith('en')) return 'en';
  }
  return DEFAULT_LOCALE;
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const hasLocale = LOCALES.some((l) => pathname === `/${l}` || pathname.startsWith(`/${l}/`));
  if (hasLocale) return NextResponse.next();

  const locale = negotiate(req.headers.get('accept-language'));
  const url = req.nextUrl.clone();
  // `/` → `/en`, `/map` → `/en/map` 처럼 프리픽스만 붙인다.
  url.pathname = `/${locale}${pathname === '/' ? '' : pathname}`;
  return NextResponse.redirect(url);
}

export const config = {
  // API·정적파일·에셋은 건드리지 않는다.
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|icon.svg|robots.txt|sitemap.xml|.*\\..*).*)'],
};
