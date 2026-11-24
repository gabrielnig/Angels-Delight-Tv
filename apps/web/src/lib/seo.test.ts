import { describe, expect, it } from 'vitest';
import { largestImage, previewMetadata } from './seo';

describe('largestImage', () => {
  it('takes the widest entry in a srcset and keeps the 16 by 9 shape', () => {
    expect(
      largestImage({
        src: 'https://m.test/a-320.webp',
        srcSet:
          'https://m.test/a-320.webp 320w, https://m.test/a-960.webp 960w, https://m.test/a-640.webp 640w',
      }),
    ).toEqual({ url: 'https://m.test/a-960.webp', width: 960, height: 540 });
  });
  it('falls back to the plain src without sizes, and to nothing without a thumbnail', () => {
    expect(largestImage({ src: '/p.webp' })).toEqual({ url: '/p.webp' });
    expect(largestImage(undefined)).toBeNull();
  });
});

describe('previewMetadata (open graph for shared links)', () => {
  const base = {
    kind: 'video' as const,
    title: 'Rivers of Nigeria',
    description: 'Where the rivers start and where they end.',
    path: '/title/rivers',
    siteName: 'Angels Delight TV',
    thumbnail: { src: '/p.webp', srcSet: '/p.webp 960w' },
    durationSeconds: 600,
  };

  it('carries title, description, canonical address, site name, image with size and alt, and a twitter card', () => {
    const m = previewMetadata(base);
    expect(m.title).toBe('Rivers of Nigeria');
    expect(m.description).toBe(base.description);
    expect(m.alternates?.canonical).toBe('/title/rivers');
    expect(m.openGraph).toMatchObject({
      title: 'Rivers of Nigeria',
      description: base.description,
      url: '/title/rivers',
      siteName: 'Angels Delight TV',
      type: 'video.other',
      images: [{ url: '/p.webp', width: 960, height: 540, alt: 'Rivers of Nigeria' }],
    });
    expect(m.twitter).toMatchObject({ card: 'summary_large_image', title: 'Rivers of Nigeria' });
  });

  it('states the running time for a video and uses a website type for a series', () => {
    expect(previewMetadata(base).other).toMatchObject({ 'video:duration': '600' });
    const series = previewMetadata({
      ...base,
      kind: 'series',
      path: '/series/s',
      durationSeconds: undefined,
    });
    expect(series.openGraph).toMatchObject({ type: 'website' });
    expect(series.other?.['video:duration']).toBeUndefined();
  });

  it('uses the summary card and no image entry when there is no poster, so the site image applies', () => {
    const m = previewMetadata({ ...base, thumbnail: undefined });
    expect(m.twitter).toMatchObject({ card: 'summary' });
    expect(m.openGraph).not.toHaveProperty('images');
  });

  it('shortens a long description to a sentence that fits a share card', () => {
    const m = previewMetadata({ ...base, description: 'word '.repeat(100) });
    expect(String(m.description).length).toBeLessThanOrEqual(200);
    expect(String(m.description)).toMatch(/…$|\.\.\.$/);
  });

  it('asks search engines to skip a title that is not indexable (R26)', () => {
    expect(previewMetadata({ ...base, indexable: false }).robots).toEqual({
      index: false,
      follow: false,
    });
  });

  it('leaves robots alone for an indexable title', () => {
    expect(previewMetadata(base).robots).toBeUndefined();
    expect(previewMetadata({ ...base, indexable: true }).robots).toBeUndefined();
  });

  it('prefers the generated share image at 1200 by 630 and uses the large twitter card', () => {
    const m = previewMetadata({
      ...base,
      thumbnail: undefined,
      shareImagePath: '/og/title/rivers?v=abc',
    });
    expect(m.openGraph).toMatchObject({
      images: [
        { url: '/og/title/rivers?v=abc', width: 1200, height: 630, alt: 'Rivers of Nigeria' },
      ],
    });
    expect(m.twitter).toMatchObject({
      card: 'summary_large_image',
      images: ['/og/title/rivers?v=abc'],
    });
  });

  it('declares the og locale', () => {
    expect(previewMetadata(base).openGraph).toMatchObject({ locale: 'en_NG' });
  });
});
