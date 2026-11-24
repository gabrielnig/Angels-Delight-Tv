import { describe, expect, it } from 'vitest';
import {
  breadcrumbList,
  isoDuration,
  organizationJsonLd,
  serializeJsonLd,
  tvSeries,
  videoObject,
  webSiteJsonLd,
} from './jsonld';

const origin = 'https://example.test';
const video = {
  origin,
  slug: 'rivers',
  title: 'Rivers of Nigeria',
  description: 'Where the rivers start.',
  thumbnails: ['https://m.test/p-960.webp'],
  uploadDate: '2026-03-04T10:00:00.000Z',
  durationSeconds: 754,
  language: 'en',
  publisher: { name: 'Angels Delight TV', logoUrl: 'https://m.test/logo.png' },
};

describe('VideoObject (M45-S02)', () => {
  it('has name, thumbnail and upload date, and points embedUrl at the title page', () => {
    const data = videoObject(video);
    expect(data!).toMatchObject({
      '@context': 'https://schema.org',
      '@type': 'VideoObject',
      name: 'Rivers of Nigeria',
      description: 'Where the rivers start.',
      thumbnailUrl: ['https://m.test/p-960.webp'],
      uploadDate: '2026-03-04T10:00:00.000Z',
      embedUrl: 'https://example.test/title/rivers',
      isAccessibleForFree: true,
      inLanguage: 'en',
    });
    expect(data).not.toHaveProperty('contentUrl');
  });

  it('writes the duration as ISO 8601', () => {
    expect(isoDuration(754)).toBe('PT12M34S');
    expect(isoDuration(3600)).toBe('PT1H');
    expect(isoDuration(3725)).toBe('PT1H2M5S');
    expect(isoDuration(59)).toBe('PT59S');
    expect(videoObject(video)?.duration).toBe('PT12M34S');
  });

  it('omits fields that have no value instead of emitting empty strings', () => {
    const data = videoObject({
      ...video,
      description: '  ',
      durationSeconds: 0,
      language: undefined,
      publisher: undefined,
    });
    expect(data).not.toHaveProperty('description');
    expect(data).not.toHaveProperty('duration');
    expect(data).not.toHaveProperty('inLanguage');
    expect(data).not.toHaveProperty('publisher');
  });

  it('returns null without the three required fields', () => {
    expect(videoObject({ ...video, thumbnails: [] })).toBeNull();
    expect(videoObject({ ...video, uploadDate: '' })).toBeNull();
    expect(videoObject({ ...video, title: '' })).toBeNull();
  });

  it('plain texts and truncates the description at 5000 characters', () => {
    const data = videoObject({ ...video, description: `<b>Hi</b> ${'x'.repeat(6000)}` });
    expect(String(data?.description).length).toBeLessThanOrEqual(5000);
    expect(String(data?.description)).not.toContain('<b>');
  });

  it('never emits a rating', () => {
    const json = JSON.stringify([
      videoObject(video),
      tvSeries({ origin, slug: 's', title: 'S', episodes: [] }),
    ]);
    expect(json).not.toMatch(/aggregateRating|ratingValue|review/i);
  });
});

describe('TVSeries', () => {
  const episodes = Array.from({ length: 80 }, (_, i) => ({
    name: `Episode ${i + 1}`,
    episodeNumber: i + 1,
    path: `/watch/e${i + 1}`,
  }));

  it('lists at most 50 episodes', () => {
    const data = tvSeries({
      origin,
      slug: 'money',
      title: 'Money',
      episodes,
      numberOfEpisodes: 80,
    });
    expect(data['@type']).toBe('TVSeries');
    expect(data.episode).toHaveLength(50);
    expect(data.numberOfEpisodes).toBe(80);
    expect(data.episode?.[0]).toMatchObject({
      '@type': 'TVEpisode',
      episodeNumber: 1,
      name: 'Episode 1',
    });
  });

  it('uses the title page of the series as its url', () => {
    expect(tvSeries({ origin, slug: 'money', title: 'Money', episodes: [] }).url).toBe(
      'https://example.test/series/money',
    );
  });
});

describe('BreadcrumbList, WebSite, Organization', () => {
  it('breadcrumb positions start at 1 and urls are absolute', () => {
    const data = breadcrumbList(origin, [
      { name: 'Home', path: '/' },
      { name: 'Money', path: '/browse/money' },
      { name: 'Budgeting', path: '/title/budgeting' },
    ]);
    expect(data.itemListElement.map((i) => i.position)).toEqual([1, 2, 3]);
    expect(data.itemListElement[1]?.item).toBe('https://example.test/browse/money');
  });

  it('WebSite carries a search action only when search is on', () => {
    const on = webSiteJsonLd({ origin, name: 'ADTV', search: true });
    expect(on.potentialAction).toMatchObject({
      '@type': 'SearchAction',
      target: 'https://example.test/search?q={search_term_string}',
      'query-input': 'required name=search_term_string',
    });
    expect(webSiteJsonLd({ origin, name: 'ADTV', search: false })).not.toHaveProperty(
      'potentialAction',
    );
  });

  it('Organization has a name and url, and a logo only when there is one', () => {
    expect(organizationJsonLd({ origin, name: 'ADTV' })).toEqual({
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'ADTV',
      url: origin,
    });
    expect(organizationJsonLd({ origin, name: 'ADTV', logoUrl: 'https://m.test/l.png' }).logo).toBe(
      'https://m.test/l.png',
    );
  });
});

describe('serializeJsonLd', () => {
  it('escapes script breakout in titles', () => {
    const text = serializeJsonLd(
      videoObject({ ...video, title: '</script><script>alert(1)</script>' }),
    );
    expect(text).not.toContain('</script>');
    expect(text).not.toContain('<');
    expect(JSON.parse(text).name).toBe('</script><script>alert(1)</script>');
  });

  it('escapes ampersands and line separators too', () => {
    const text = serializeJsonLd({ a: `x & y ${String.fromCharCode(0x2028)} z` });
    expect(text).not.toContain('&');
    expect(text).not.toContain(String.fromCharCode(0x2028));
    expect(JSON.parse(text).a).toBe(`x & y ${String.fromCharCode(0x2028)} z`);
  });
});
