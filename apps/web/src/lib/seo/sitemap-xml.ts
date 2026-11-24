import type { SitemapEntry } from './sitemap';

const NS = 'http://www.sitemaps.org/schemas/sitemap/0.9';

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function renderUrlsetXml(entries: SitemapEntry[]): string {
  const body = entries
    .map((entry) => {
      const last = entry.lastModified
        ? `<lastmod>${new Date(entry.lastModified).toISOString()}</lastmod>`
        : '';
      return `<url><loc>${escapeXml(entry.url)}</loc>${last}</url>`;
    })
    .join('');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="${NS}">${body}</urlset>\n`;
}

export function renderIndexXml(locations: string[]): string {
  const body = locations.map((loc) => `<sitemap><loc>${escapeXml(loc)}</loc></sitemap>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="${NS}">${body}</sitemapindex>\n`;
}
