import { NextResponse } from 'next/server';

import { getDetailCached } from '@/lib/kto-cache';
import { isLocale, SERVICE_BY_LOCALE } from '@/lib/i18n';
import { cleanName } from '@/lib/shops';

/**
 * 한 매장의 상세(overview 등). detailCommon2. 사용자가 여는 것만 lazy 로 쳐서 쿼터를 분산한다.
 *
 * 상태 구분이 이 앱의 정직함이다(F-6):
 *  - overview 가 빈 문자열/없음 → 그 언어로 설명이 **없음**(missing). 한국어/기계번역으로 안 메운다(F-2).
 *  - 조회 자체 실패(쿼터·타임아웃) → **불러오지 못함**(unavailable). 캐시하지 않는다(F-4).
 */
const CACHE_OK = 'public, s-maxage=43200, stale-while-revalidate=86400';
const CACHE_FAIL = 'no-store';

/** `<a href="http://...">` 또는 평문에서 첫 http(s) URL 만 추출. 없으면 null. */
function extractUrl(raw: string | undefined): string | null {
  if (!raw) return null;
  const href = /href=["']?(https?:\/\/[^"'\s>]+)/i.exec(raw)?.[1];
  if (href) return href;
  const bare = /https?:\/\/[^\s"'<>]+/i.exec(raw)?.[0];
  return bare ?? null;
}

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const { searchParams } = new URL(req.url);
  const lang = searchParams.get('lang') ?? '';
  if (!isLocale(lang)) {
    return NextResponse.json({ error: 'invalid lang' }, { status: 400 });
  }
  if (!/^\d+$/.test(id)) {
    return NextResponse.json({ error: 'invalid id' }, { status: 400 });
  }

  try {
    const raw = await getDetailCached(SERVICE_BY_LOCALE[lang], id);
    const overview = raw?.overview?.trim() || null;
    // homepage 는 보통 `<a href="...">` HTML 로 온다. 안전하게 URL 만 뽑는다(원문 HTML 미노출).
    const homepage = extractUrl(raw?.homepage);
    return NextResponse.json(
      {
        overview,
        homepage,
        title: raw?.title ? cleanName(raw.title) : null,
        unavailable: false,
      },
      { headers: { 'Cache-Control': CACHE_OK } },
    );
  } catch {
    return NextResponse.json(
      { overview: null, homepage: null, title: null, unavailable: true },
      { headers: { 'Cache-Control': CACHE_FAIL } },
    );
  }
}
