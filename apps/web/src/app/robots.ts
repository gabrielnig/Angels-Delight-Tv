import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { MetadataRoute } from 'next';

/**
 * What crawlers may read. The public catalog (Home, Browse, title and series pages) is open because visitors can
 * watch without an account (M40). Everything personal, every API route and every sign in page is closed, and so is
 * search, whose result pages have no value to an index. The sitemap line appears as soon as the app has one.
 */
export default function robots(): MetadataRoute.Robots {
  const origin = process.env.APP_ORIGIN?.replace(/\/+$/, '');
  const hasSitemap =
    existsSync(resolve(process.cwd(), 'src/app/sitemap.ts')) ||
    existsSync(resolve(__dirname, 'sitemap.ts'));
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
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
        '/verify-email',
      ],
    },
    ...(origin && hasSitemap ? { sitemap: `${origin}/sitemap.xml` } : {}),
  };
}
