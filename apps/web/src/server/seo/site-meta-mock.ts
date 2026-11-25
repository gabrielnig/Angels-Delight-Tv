import { buildMetadata, type PageMeta, type SiteMeta } from '../../lib/seo/metadata';

/** Test double for `site-meta`: the real builder with fixed site values, so page tests need no settings or locale. */
export const TEST_SITE: SiteMeta = {
  siteName: 'Test TV',
  description: 'Test description.',
  defaultImage: { url: '/brand-icons/placeholder-og.png', width: 1200, height: 630, type: 'image/png' },
  locale: 'en_NG',
  alternateLocales: [],
  indexing: true,
};

export const siteMetaMock = () => ({
  pageMetadata: async (page: PageMeta) => buildMetadata(TEST_SITE, page),
  getSiteMeta: async () => TEST_SITE,
});
