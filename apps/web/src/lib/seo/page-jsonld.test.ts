import { describe, expect, it } from 'vitest';
import type { SeriesDetail, SeriesSummary, VideoSummary } from '../data/types';
import { buildMetadata, trimWords } from './metadata';
import {
  categoryPageJsonLd,
  homePageJsonLd,
  seriesPageJsonLd,
  thumbnailUrls,
  titlePageJsonLd,
} from './page-jsonld';

const origin = 'https://example.test';
const video: VideoSummary = {
  kind: 'video',
  id: 'v1',
  slug: 'rivers',
  title: 'Rivers of Nigeria',
  description: 'Where the rivers start.',
  durationSeconds: 600,
  categorySlug: 'geography',
  categoryName: 'Geography',
  thumbnail: { src: '/p-320.webp', srcSet: '/p-320.webp 320w, /p-960.webp 960w' },
  hasCaptions: true,
  kidsSafe: false,
  publishedAt: '2026-03-04T10:00:00.000Z',
};

describe('thumbnailUrls', () => {
  it('makes urls absolute and lists the widest first', () => {
    expect(thumbnailUrls(origin, video.thumbnail)).toEqual([
      'https://example.test/p-960.webp',
      'https://example.test/p-320.webp',
    ]);
  });
  it('keeps absolute media urls and handles a missing poster', () => {
    expect(thumbnailUrls(origin, { src: 'https://m.test/a.webp' })).toEqual([
      'https://m.test/a.webp',
    ]);
    expect(thumbnailUrls(origin, undefined)).toEqual([]);
  });
});

describe('titlePageJsonLd', () => {
  it('has a VideoObject and a Home > Category > Title breadcrumb', () => {
    const blocks = titlePageJsonLd({ origin, siteName: 'ADTV', video });
    expect(blocks.map((b) => b['@type'])).toEqual(['VideoObject', 'BreadcrumbList']);
    const crumbs = (blocks[1] as { itemListElement: { name: string }[] }).itemListElement;
    expect(crumbs.map((c) => c.name)).toEqual(['Home', 'Geography', 'Rivers of Nigeria']);
  });

  it('leaves the category out of the breadcrumb when there is none', () => {
    const blocks = titlePageJsonLd({
      origin,
      siteName: 'ADTV',
      video: { ...video, categorySlug: '', categoryName: '' },
    });
    const crumbs = (blocks[1] as { itemListElement: { name: string }[] }).itemListElement;
    expect(crumbs.map((c) => c.name)).toEqual(['Home', 'Rivers of Nigeria']);
  });

  it('renders the breadcrumb alone when the video object cannot be built', () => {
    const blocks = titlePageJsonLd({
      origin,
      siteName: 'ADTV',
      video: { ...video, thumbnail: undefined },
    });
    expect(blocks.map((b) => b['@type'])).toEqual(['BreadcrumbList']);
  });

  it('returns nothing without an origin, since urls must be absolute', () => {
    expect(titlePageJsonLd({ origin: undefined, siteName: 'ADTV', video })).toEqual([]);
  });
});

describe('seriesPageJsonLd', () => {
  const detail = {
    series: {
      kind: 'series',
      slug: 'money',
      title: 'Money 101',
      description: 'Basics.',
      categorySlug: 'money',
      categoryName: 'Money',
      episodeCount: 2,
      seasonCount: 1,
      kidsSafe: false,
      hasCaptions: false,
      publishedAt: '2026-01-01T00:00:00Z',
      thumbnail: { src: '/s.webp' },
    },
    seasons: [
      {
        number: 1,
        episodes: [
          { number: 1, video: { ...video, id: 'e1', title: 'First' } },
          { number: 2, video: { ...video, id: 'e2', title: 'Second' } },
        ],
      },
    ],
  } as unknown as SeriesDetail;

  it('has a TVSeries with episodes that link to their watch pages and a breadcrumb', () => {
    const blocks = seriesPageJsonLd({ origin, series: detail.series, seasons: detail.seasons });
    expect(blocks.map((b) => b['@type'])).toEqual(['TVSeries', 'BreadcrumbList']);
    const episodes = (blocks[0] as { episode: { name: string; url: string }[] }).episode;
    expect(episodes.map((e) => e.name)).toEqual(['First', 'Second']);
    expect(episodes[0]?.url).toBe('https://example.test/watch/e1');
  });
});

describe('home and category', () => {
  it('home has the WebSite and the Organization', () => {
    const blocks = homePageJsonLd({ origin, name: 'ADTV', search: true });
    expect(blocks.map((b) => b['@type'])).toEqual(['WebSite', 'Organization']);
  });
  it('category has Home > Category', () => {
    const blocks = categoryPageJsonLd({ origin, name: 'Money', slug: 'money' });
    expect((blocks[0] as { itemListElement: unknown[] }).itemListElement).toHaveLength(2);
  });
});

describe('alignment with Open Graph (L15b)', () => {
  const long = { ...video, description: 'Rivers carry water and stories. '.repeat(20) };
  const share = '/og/title/rivers?v=abc';

  it('a video object uses the share picture first and the same trimmed description as og:description', () => {
    const [object] = titlePageJsonLd({ origin, siteName: 'Test TV', video: long, shareImage: share });
    expect((object!.thumbnailUrl as string[])[0]).toBe('https://example.test/og/title/rivers?v=abc');
    expect(object!.description).toBe(trimWords(long.description, 160));
    const meta = buildMetadata(
      { siteName: 'Test TV', description: 'x', locale: 'en_NG', alternateLocales: [], indexing: true },
      { kind: 'video', path: '/title/rivers', title: long.title, description: long.description },
    );
    expect(object!.description).toBe(meta.openGraph?.description);
    expect(object!.name).toBe(meta.openGraph?.title);
  });

  it('a series uses the share picture first and the trimmed description', () => {
    const series = {
      kind: 'series', id: 's1', slug: 'rivers', title: 'Rivers', description: long.description,
      categorySlug: '', categoryName: '', episodeCount: 1, kidsSafe: false, hasCaptions: false, publishedAt: '',
      thumbnail: video.thumbnail,
    } as unknown as SeriesSummary;
    const [tv] = seriesPageJsonLd({ origin, series, seasons: [], shareImage: '/og/series/rivers?v=z' });
    expect((tv!.image as string[])[0]).toBe('https://example.test/og/series/rivers?v=z');
    expect(tv!.description).toBe(trimWords(long.description, 160));
  });

  it('the organisation lists the X profile from the handle and the default share image as logo', () => {
    const [, org] = homePageJsonLd({ origin, name: 'Test TV', search: true, twitterHandle: '@learntv', logoUrl: '/brand-icons/placeholder-og.png' });
    expect(org!.sameAs).toEqual(['https://x.com/learntv']);
    expect(org!.logo).toBe('https://example.test/brand-icons/placeholder-og.png');
    const [, none] = homePageJsonLd({ origin, name: 'Test TV', search: true, twitterHandle: '' });
    expect(none).not.toHaveProperty('sameAs');
  });
});
