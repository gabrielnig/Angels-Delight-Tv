import { describe, expect, it } from 'vitest';
import { renderIndexXml, renderUrlsetXml } from './sitemap-xml';

describe('sitemap xml (M45-S01)', () => {
  it('renders a urlset with lastmod as an ISO date', () => {
    const xml = renderUrlsetXml([
      { url: 'https://e.test/title/a', lastModified: new Date('2026-01-02T03:04:05Z') },
      { url: 'https://e.test/' },
    ]);
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    expect(xml).toContain(
      '<loc>https://e.test/title/a</loc><lastmod>2026-01-02T03:04:05.000Z</lastmod>',
    );
    expect(xml).toContain('<url><loc>https://e.test/</loc></url>');
    expect(xml).not.toContain('changefreq');
    expect(xml).not.toContain('priority');
  });

  it('escapes characters that would break the xml', () => {
    const xml = renderUrlsetXml([{ url: 'https://e.test/a?x=1&y=<2>' }]);
    expect(xml).toContain('https://e.test/a?x=1&amp;y=&lt;2&gt;');
  });

  it('renders an index of sitemap files', () => {
    const xml = renderIndexXml(['https://e.test/sitemaps/1.xml', 'https://e.test/sitemaps/2.xml']);
    expect(xml).toContain('<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    expect(xml).toContain('<sitemap><loc>https://e.test/sitemaps/2.xml</loc></sitemap>');
  });
});
