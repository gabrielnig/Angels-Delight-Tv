import { describe, expect, it } from 'vitest';
import {
  MAX_URL_LENGTH,
  SITEMAP_CHUNK_SIZE,
  buildSitemapEntries,
  chunkEntries,
  type SitemapRows,
} from './sitemap';

const origin = 'https://example.test';
const day = (n: number) => new Date(Date.UTC(2026, 0, n));

function rows(overrides: Partial<SitemapRows> = {}): SitemapRows {
  return {
    videos: [{ slug: 'budgeting-basics', lastmod: day(3) }],
    series: [{ slug: 'money-101', lastmod: day(5) }],
    categories: [{ slug: 'money', lastmod: day(2) }],
    ...overrides,
  };
}

describe('sitemap entries (M45-S01)', () => {
  it('lists the static pages, categories, titles and series on the configured origin', () => {
    const urls = buildSitemapEntries(origin, rows()).map((e) => e.url);
    expect(urls).toEqual(
      expect.arrayContaining([
        `${origin}/`,
        `${origin}/browse`,
        `${origin}/about`,
        `${origin}/help`,
        `${origin}/privacy`,
        `${origin}/terms`,
        `${origin}/browse/money`,
        `${origin}/title/budgeting-basics`,
        `${origin}/series/money-101`,
      ]),
    );
  });

  it('sets lastmod from the row and omits changefreq and priority', () => {
    const entry = buildSitemapEntries(origin, rows()).find((e) =>
      e.url.endsWith('/title/budgeting-basics'),
    );
    expect(entry?.lastModified).toEqual(day(3));
    expect(entry).not.toHaveProperty('changeFrequency');
    expect(entry).not.toHaveProperty('priority');
  });

  it('lists only the static pages when the catalog is empty', () => {
    const entries = buildSitemapEntries(origin, { videos: [], series: [], categories: [] });
    expect(entries.map((e) => e.url)).toEqual([
      `${origin}/`,
      `${origin}/browse`,
      `${origin}/about`,
      `${origin}/help`,
      `${origin}/privacy`,
      `${origin}/terms`,
    ]);
  });

  it('never emits a url longer than 2048 characters', () => {
    const long = 'a'.repeat(MAX_URL_LENGTH);
    const entries = buildSitemapEntries(
      origin,
      rows({ videos: [{ slug: long, lastmod: day(1) }] }),
    );
    expect(entries.every((e) => e.url.length <= MAX_URL_LENGTH)).toBe(true);
    expect(entries.some((e) => e.url.includes(long))).toBe(false);
  });

  it('encodes slugs and trims a trailing slash on the origin', () => {
    const entries = buildSitemapEntries(
      'https://example.test/',
      rows({ videos: [{ slug: 'a b', lastmod: day(1) }] }),
    );
    expect(entries.map((e) => e.url)).toContain('https://example.test/title/a%20b');
  });

  it('splits into files of 5000 urls', () => {
    expect(SITEMAP_CHUNK_SIZE).toBe(5000);
    const many = Array.from({ length: 12_000 }, (_, i) => ({ slug: `t-${i}`, lastmod: day(1) }));
    const chunks = chunkEntries(buildSitemapEntries(origin, rows({ videos: many })));
    expect(chunks.map((c) => c.length)).toEqual([5000, 5000, 2008]);
  });

  it('always returns at least one chunk', () => {
    expect(chunkEntries([])).toEqual([[]]);
  });
});
