import { sitemapHandlers } from '../../../server/seo/sitemap-data';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return sitemapHandlers.chunk(request, id);
}
