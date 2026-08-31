import type { MetadataRoute } from 'next';

import { HTML_LANG, LOCALES } from '@/lib/i18n';

const SITE = 'https://kr-taxfree-now.vercel.app';

/**
 * 언어별 랜딩·지도 URL 을 사이트맵에 넣고, 각 URL 에 hreflang 대체를 단다.
 * 검색엔진이 방문자 언어에 맞는 페이지를 고르게 한다.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const languages = Object.fromEntries(LOCALES.map((l) => [HTML_LANG[l], `${SITE}/${l}`]));
  const entries: MetadataRoute.Sitemap = [];
  for (const l of LOCALES) {
    entries.push({
      url: `${SITE}/${l}`,
      changeFrequency: 'daily',
      priority: 1,
      alternates: { languages },
    });
    entries.push({
      url: `${SITE}/${l}/map`,
      changeFrequency: 'daily',
      priority: 0.8,
    });
  }
  return entries;
}
