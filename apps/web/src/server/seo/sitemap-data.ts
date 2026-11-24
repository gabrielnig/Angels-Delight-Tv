import 'server-only';
import { listSitemapRows } from '@ad/catalog';
import { getServices } from '../../lib/runtime/services';
import { realDataEnabled } from '../data/mode';
import type { SitemapRows } from '../../lib/seo/sitemap';
import { createSitemapHandlers } from './sitemap-handlers';

/** Real catalog rows. Fixture mode (dev flag only) has no database, so the sitemap lists the static pages. */
async function load(): Promise<SitemapRows> {
  if (!realDataEnabled()) return { videos: [], series: [], categories: [] };
  return listSitemapRows(getServices().db, new Date());
}

export const sitemapHandlers = createSitemapHandlers({
  load,
  origin: () => process.env.APP_ORIGIN,
});
