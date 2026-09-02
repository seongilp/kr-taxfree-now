import { NextResponse } from 'next/server';

import { LOCALES } from '@/lib/i18n';

/**
 * 카탈로그 예열(cron). **첫 사용자가 콜드 12페이지 수집(실측 4.5s)을 안 밟도록** 미리 데운다.
 *
 * 언어당 좌표 없는 엔드포인트(`/api/shops?lang=X&taxRefundOnly=1`)를 자기 공개 URL 로 때린다:
 *  - 카탈로그를 **인스턴스 간 공유 Data Cache** 에 채운다(kto-api 의 fetchJson revalidate).
 *  - 그 응답은 좌표 없이 전 사용자 동일이라 **CDN 에도** 채워진다(라우트가 SWR 헤더를 붙인다).
 * 서버에서 getCatalogCached 만 부르면 CDN 은 안 채워지므로 반드시 공개 도메인으로 요청한다.
 *
 * ★ Vercel Hobby 크론은 **하루 1회**(±59분). 그래서 이 예열은 자정 이후(SWR 창이 KST 자정에
 *   잘려 만료된 뒤) 그날 첫 요청만 커버한다. 낮 동안의 즉시성은 stale-while-revalidate 가 맡는다.
 *
 * 쿼터: 하루 1회 × 4언어 × 12페이지 = 48콜/일(오퍼레이션당 1,000/일의 5% 미만). 여유 큼.
 *
 * fail closed: **CRON_SECRET 없으면 503, 안 맞으면 401.** 공개로 뚫려 아무나 예열을 못 돌리게.
 */

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function baseUrl(): string {
  const host = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? 'kr-taxfree-now.vercel.app';
  return `https://${host}`;
}

async function warmOne(lang: string): Promise<Record<string, unknown>> {
  const started = Date.now();
  const path = `/api/shops?lang=${encodeURIComponent(lang)}&taxRefundOnly=1`;
  try {
    const res = await fetch(`${baseUrl()}${path}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(45_000),
      headers: { Accept: 'application/json' },
    });
    const ms = Date.now() - started;
    const cache = res.headers.get('x-vercel-cache');
    if (!res.ok) return { lang, ok: false, status: res.status, cache, ms };
    // '일을 했는지' 증명: 채운 매장 수를 응답에서 읽어 담는다(ok:true 인데 빈 크론 방지).
    const body = (await res.json()) as { shops?: unknown[]; meta?: { total?: number } };
    return {
      lang,
      ok: true,
      status: res.status,
      cache,
      ms,
      returned: Array.isArray(body.shops) ? body.shops.length : 0,
      total: body.meta?.total ?? 0,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { lang, ok: false, error: message, ms: Date.now() - started };
  }
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: 'CRON_SECRET 이 설정되지 않았습니다 (fail closed).' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json(
      { error: '인증 실패' },
      { status: 401, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  // 순차 예열(업스트림 부하 최소화, 언어 4개뿐).
  const results: Record<string, unknown>[] = [];
  for (const lang of LOCALES) {
    results.push(await warmOne(lang));
  }

  const allOk = results.every((r) => r.ok === true);
  return NextResponse.json(
    { ok: allOk, warmedAt: new Date().toISOString(), results },
    { status: allOk ? 200 : 502, headers: { 'Cache-Control': 'no-store' } },
  );
}
