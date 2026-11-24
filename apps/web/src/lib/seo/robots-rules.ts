import type { MetadataRoute } from 'next';

const CLOSED = [
  '/api/',
  '/admin',
  '/account',
  '/profiles',
  '/settings',
  '/my-list',
  '/watch/',
  '/search',
  '/sign-in',
  '/sign-up',
  '/reset-password',
  '/verify-email',
  '/donate/thank-you',
  '/donate/cancelled',
  '/offline',
  '/maintenance',
  '/unsupported',
];

/**
 * What crawlers may read. The public catalog is open (M40). Everything personal, every API route, every sign in
 * page and search result pages are closed. A staging site, or one with indexing switched off in the Discovery
 * tab, closes everything and names no sitemap (M45-S01 AC4).
 */
export function buildRobots(input: {
  origin: string | undefined;
  indexing: boolean;
  production: boolean;
}): MetadataRoute.Robots {
  if (!input.indexing || !input.production) {
    return { rules: { userAgent: '*', disallow: '/' } };
  }
  return {
    rules: { userAgent: '*', allow: '/', disallow: CLOSED },
    ...(input.origin ? { sitemap: `${input.origin.replace(/\/+$/, '')}/sitemap.xml` } : {}),
  };
}
