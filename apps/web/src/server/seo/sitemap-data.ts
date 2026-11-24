import 'server-only';
import { listSitemapRows } from '@ad/catalog';
import { getServices } from '../../lib/runtime/services';
import { realDataEnabled } from '../data/mode';
import type { SitemapRows } from '../../lib/seo/sitemap';
import { donateAvailable } from '../donations/availability';
import { createSitemapHandlers } from './sitemap-handlers';

/** Real catalog rows. Fixture mode (dev flag only) has no database, so the sitemap lists the static pages. */
async function load(): Promise<SitemapRows> {
  const extraPaths = (await donateAvailable()) ? ['/donate'] : [];
  if (!realDataEnabled()) return { videos: [], series: [], categories: [], extraPaths };
  return { ...(await listSitemapRows(getServices().db, new Date())), extraPaths };
}

export const sitemapHandlers = createSitemapHandlers({
  load,
  origin: () => process.env.APP_ORIGIN,
});
