import { sitemapHandlers } from '../../server/seo/sitemap-data';

export const dynamic = 'force-dynamic';

export function GET(request: Request) {
  return sitemapHandlers.index(request);
}
