import type { MetadataRoute } from 'next';

export type SitemapEntry = MetadataRoute.Sitemap[number];

export interface SitemapRows {
  videos: { slug: string; lastmod: Date }[];
  series: { slug: string; lastmod: Date }[];
  categories: { slug: string; lastmod: Date }[];
}

/** Well under the protocol limit of 50,000 urls and 50 MB per file (D-L6-4). */
export const SITEMAP_CHUNK_SIZE = 5000;
/** Search engines ignore longer urls (sitemaps.org). */
export const MAX_URL_LENGTH = 2048;

const STATIC_PATHS = ['/', '/browse', '/about', '/help', '/privacy', '/terms'];

/**
 * Pure builder: rows from the catalog in, sitemap entries out. No changefreq or priority, because search engines
 * ignore both. A row whose address would be too long is dropped instead of emitted broken.
 */
export function buildSitemapEntries(origin: string, rows: SitemapRows): SitemapEntry[] {
  const base = origin.replace(/\/+$/, '');
  const entries: SitemapEntry[] = STATIC_PATHS.map((path) => ({ url: `${base}${path}` }));
  const add = (prefix: string, list: { slug: string; lastmod: Date }[]) => {
    for (const row of list) {
      const url = `${base}${prefix}${encodeURIComponent(row.slug)}`;
      if (url.length <= MAX_URL_LENGTH) entries.push({ url, lastModified: row.lastmod });
    }
  };
  add('/browse/', rows.categories);
  add('/title/', rows.videos);
  add('/series/', rows.series);
  return entries;
}

export function chunkEntries(entries: SitemapEntry[]): SitemapEntry[][] {
  if (entries.length === 0) return [[]];
  const chunks: SitemapEntry[][] = [];
  for (let i = 0; i < entries.length; i += SITEMAP_CHUNK_SIZE) {
    chunks.push(entries.slice(i, i + SITEMAP_CHUNK_SIZE));
  }
  return chunks;
}
