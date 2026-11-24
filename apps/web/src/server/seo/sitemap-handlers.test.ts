import { describe, expect, it } from 'vitest';
import { createSitemapHandlers } from './sitemap-handlers';
import { SITEMAP_CHUNK_SIZE, type SitemapRows } from '../../lib/seo/sitemap';

const day = new Date('2026-01-01T00:00:00Z');
const rowsOf = (n: number): SitemapRows => ({
  videos: Array.from({ length: n }, (_, i) => ({ slug: `t-${i}`, lastmod: day })),
  series: [],
  categories: [],
});
const origin = 'https://e.test';
const req = new Request('https://e.test/sitemap.xml');

function handlers(load: () => Promise<SitemapRows>, o = origin) {
  return createSitemapHandlers({ load, origin: () => o });
}

describe('sitemap handlers (M45-S01)', () => {
  it('serves one urlset when everything fits in a file', async () => {
    const res = await handlers(async () => rowsOf(3)).index(req);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/xml');
    expect(res.headers.get('cache-control')).toContain('s-maxage=3600');
    const xml = await res.text();
    expect(xml).toContain('<urlset');
    expect(xml).toContain('https://e.test/title/t-2');
  });

  it('lists only the static pages when the catalog is empty, with a 200', async () => {
    const res = await handlers(async () => rowsOf(0)).index(req);
    expect(res.status).toBe(200);
    const xml = await res.text();
    expect(xml).toContain('https://e.test/browse');
    expect(xml).not.toContain('/title/');
  });

  it('serves an index and numbered files when it has to split', async () => {
    const h = handlers(async () => rowsOf(SITEMAP_CHUNK_SIZE + 10));
    const index = await (await h.index(req)).text();
    expect(index).toContain('<sitemapindex');
    expect(index).toContain('https://e.test/sitemaps/1.xml');
    expect(index).toContain('https://e.test/sitemaps/2.xml');
    const second = await h.chunk(req, '2.xml');
    expect(second.status).toBe(200);
    expect(await second.text()).toContain('<urlset');
  });

  it('answers 404 for a file that does not exist', async () => {
    const h = handlers(async () => rowsOf(3));
    expect((await h.chunk(req, '2.xml')).status).toBe(404);
    expect((await h.chunk(req, 'abc')).status).toBe(404);
    expect((await h.chunk(req, '0.xml')).status).toBe(404);
  });

  it('answers 503 with Retry-After when the catalog query fails, never an empty 200', async () => {
    const h = handlers(async () => {
      throw new Error('db down');
    });
    for (const res of [await h.index(req), await h.chunk(req, '1.xml')]) {
      expect(res.status).toBe(503);
      expect(res.headers.get('retry-after')).toBe('300');
      expect(await res.text()).not.toContain('<urlset');
    }
  });

  it('answers 503 when the app origin is not configured', async () => {
    const res = await handlers(async () => rowsOf(1), '').index(req);
    expect(res.status).toBe(503);
  });
});
