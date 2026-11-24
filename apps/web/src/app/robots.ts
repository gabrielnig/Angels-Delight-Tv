import type { MetadataRoute } from 'next';

/**
 * What crawlers may read. The public catalog (Home, Browse, title and series pages) is open because visitors can
 * watch without an account (M40). Everything personal, every API route and every sign in page is closed, and so is
 * search, whose result pages have no value to an index. The sitemap line names `/sitemap.xml` on the configured origin (M45-S01).
 */
export default function robots(): MetadataRoute.Robots {
  const origin = process.env.APP_ORIGIN?.replace(/\/+$/, '');
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
    ...(origin ? { sitemap: `${origin}/sitemap.xml` } : {}),
  };
}
