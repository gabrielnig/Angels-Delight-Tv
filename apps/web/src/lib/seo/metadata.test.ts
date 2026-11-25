import { describe, expect, it } from 'vitest';
import { buildMetadata, cleanText, ogLocale, trimWords, type SiteMeta } from './metadata';

const site: SiteMeta = {
  siteName: 'Learn TV',
  description: 'Free learning videos for everyone.',
  defaultImage: { url: '/brand-icons/placeholder-og.png', width: 1200, height: 630, type: 'image/png' },
  twitterHandle: '@learntv',
  locale: 'en_NG',
  alternateLocales: ['yo_NG', 'ig_NG'],
  indexing: true,
};

describe('cleanText', () => {
  it('strips tags, entities of tags, control characters and extra spaces', () => {
    expect(cleanText('<b>Hello</b>\u0000  <script>alert(1)</script>\n world')).toBe('Hello alert(1) world');
  });
  it('keeps quotes, ampersands and diacritics', () => {
    expect(cleanText('Ọ̀rọ̀ "Ìgbà" & Àṣà, Ụlọ akwụkwọ, Hausa ɓarna')).toBe('Ọ̀rọ̀ "Ìgbà" & Àṣà, Ụlọ akwụkwọ, Hausa ɓarna');
  });
});

describe('trimWords', () => {
  it('leaves short text alone', () => {
    expect(trimWords('Short text', 160)).toBe('Short text');
  });
  it('cuts on a word boundary and never exceeds the limit', () => {
    const out = trimWords('alpha beta gamma delta epsilon zeta', 20);
    expect(out.length).toBeLessThanOrEqual(20);
    expect(out).toBe('alpha beta gamma…');
  });
  it('does not split a combining diacritic sequence', () => {
    const text = `${'a'.repeat(18)} Ọ̀rọ̀ more words here`;
    const out = trimWords(text, 22);
    expect(out.normalize('NFD')).not.toMatch(/[̀-ͯ]$/);
    expect(out.length).toBeLessThanOrEqual(22);
  });
  it('handles one very long word and very long text', () => {
    expect(trimWords('x'.repeat(500), 50).length).toBeLessThanOrEqual(50);
    expect(trimWords('word '.repeat(2000), 160).length).toBeLessThanOrEqual(160);
  });
});

describe('ogLocale', () => {
  it('converts html lang to the og format', () => {
    expect(ogLocale('en-NG')).toBe('en_NG');
    expect(ogLocale('yo')).toBe('yo_NG');
    expect(ogLocale('')).toBe('en_NG');
  });
});

describe('buildMetadata', () => {
  it('home page uses the site name and description, website type, default image', () => {
    const m = buildMetadata(site, { kind: 'website', path: '/' });
    expect(m.title).toEqual({ absolute: 'Learn TV' });
    expect(m.description).toBe(site.description);
    expect(m.alternates?.canonical).toBe('/');
    expect(m.openGraph).toMatchObject({ type: 'website', url: '/', siteName: 'Learn TV', locale: 'en_NG', alternateLocale: ['yo_NG', 'ig_NG'] });
    expect(m.openGraph?.images).toEqual([
      { url: '/brand-icons/placeholder-og.png', width: 1200, height: 630, type: 'image/png', alt: 'Learn TV' },
    ]);
    expect(m.twitter).toMatchObject({ card: 'summary_large_image', site: '@learntv', title: 'Learn TV' });
  });

  it('plain page: og title is the page title, document title gets the pattern', () => {
    const m = buildMetadata(site, { kind: 'website', path: '/about', title: 'About us', description: 'Who we are' });
    expect(m.title).toBe('About us');
    expect(m.openGraph).toMatchObject({ title: 'About us', description: 'Who we are', url: '/about' });
  });

  it('video: video.other with duration, release date, tags, generated image and alt', () => {
    const m = buildMetadata(site, {
      kind: 'video',
      path: '/title/rivers',
      title: 'Rivers of Nigeria',
      description: 'A film. '.repeat(60),
      image: { url: '/og/title/rivers?v=abc', width: 1200, height: 630, type: 'image/jpeg', alt: 'Poster of Rivers' },
      durationSeconds: 754,
      releasedAt: '2026-01-02T00:00:00.000Z',
      tags: ['Geography'],
    });
    expect(m.openGraph).toMatchObject({
      type: 'video.other',
      duration: 754,
      releaseDate: '2026-01-02T00:00:00.000Z',
      tags: ['Geography'],
    });
    expect(String(m.description).length).toBeLessThanOrEqual(160);
    expect(m.openGraph?.images).toEqual([
      { url: '/og/title/rivers?v=abc', width: 1200, height: 630, type: 'image/jpeg', alt: 'Poster of Rivers' },
    ]);
    expect(m.twitter?.images).toEqual([{ url: '/og/title/rivers?v=abc', alt: 'Poster of Rivers' }]);
    expect(m.other).toBeUndefined();
  });

  it('series is video.tv_show and episode is video.episode', () => {
    expect(buildMetadata(site, { kind: 'series', path: '/series/a', title: 'A' }).openGraph).toMatchObject({ type: 'video.tv_show' });
    expect(buildMetadata(site, { kind: 'episode', path: '/series/a', title: 'A' }).openGraph).toMatchObject({ type: 'video.episode' });
  });

  it('private pages are noindex with no og image of a title', () => {
    const m = buildMetadata(site, { kind: 'private', path: '/search', title: 'Search', follow: true });
    expect(m.robots).toEqual({ index: false, follow: true });
    expect(m.alternates).toBeUndefined();
  });

  it('indexing switched off in settings makes every page noindex', () => {
    const m = buildMetadata({ ...site, indexing: false }, { kind: 'website', path: '/' });
    expect(m.robots).toEqual({ index: false, follow: false });
  });

  it('uses twitter summary without an image and omits site when no handle', () => {
    const m = buildMetadata({ ...site, twitterHandle: undefined, defaultImage: undefined }, { kind: 'website', path: '/' });
    expect(m.twitter).toMatchObject({ card: 'summary' });
    expect(m.twitter).not.toHaveProperty('site');
  });

  it('never injects markup and normalises a handle without @', () => {
    const m = buildMetadata({ ...site, twitterHandle: 'learntv' }, { kind: 'video', path: '/title/x', title: '<img src=x onerror=1>Hi', description: '<b>x</b>' });
    expect(m.openGraph?.title).toBe('Hi');
    expect(m.description).toBe('x');
    expect(m.twitter).toMatchObject({ site: '@learntv' });
  });

  it('canonical comes from the clean path and drops tracking params', () => {
    const m = buildMetadata(site, { kind: 'website', path: '/browse', query: { utm_source: 'x', length: 'short' } });
    expect(m.alternates?.canonical).toBe('/browse?length=short');
    expect(m.openGraph?.url).toBe('/browse?length=short');
  });
});
