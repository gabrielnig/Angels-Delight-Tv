import { describe, expect, it } from 'vitest';
import { buildShareConfig } from './share-config';

const seo = { shareChannels: ['whatsapp', 'telegram'] as const, shareTemplate: '{title} on {siteName}', platformName: 'ADTV' };

describe('buildShareConfig (L15a slice 2)', () => {
  it('gives the admin channels, the filled text and the clean canonical address', () => {
    const c = buildShareConfig({ seo: { ...seo, shareChannels: [...seo.shareChannels] }, title: 'Rivers', kind: 'video', slug: 'rivers', origin: 'https://adtv.example' });
    expect(c).toEqual({
      channels: ['whatsapp', 'telegram'],
      text: 'Rivers on ADTV',
      url: 'https://adtv.example/title/rivers',
    });
  });

  it('uses the series path for a series and passes the poster along', () => {
    const c = buildShareConfig({ seo: { ...seo, shareChannels: [] }, title: 'Science', kind: 'series', slug: 'sci', origin: 'https://adtv.example/', thumbnail: '/p.webp' });
    expect(c.url).toBe('https://adtv.example/series/sci');
    expect(c.thumbnail).toBe('/p.webp');
    expect(c.channels).toEqual([]);
  });

  it('falls back to the site path when no origin is set, so the browser adds its own origin', () => {
    const c = buildShareConfig({ seo: { ...seo, shareChannels: [] }, title: 'T', kind: 'video', slug: 'a b', origin: undefined });
    expect(c.url).toBe('/title/a%20b');
  });

  it('falls back to the path when the origin is not https', () => {
    const c = buildShareConfig({ seo: { ...seo, shareChannels: [] }, title: 'T', kind: 'video', slug: 's', origin: 'http://adtv.example' });
    expect(c.url).toBe('/title/s');
  });
});
