import type { SeriesDetail, SeriesSummary, Thumb, VideoSummary } from '../data/types';
import { trimWords } from './metadata';
import { breadcrumbList, organizationJsonLd, tvSeries, videoObject, webSiteJsonLd } from './jsonld';

type Block = Record<string, unknown>;

function abs(origin: string, url: string): string {
  return /^https?:\/\//.test(url)
    ? url
    : `${origin.replace(/\/+$/, '')}${url.startsWith('/') ? '' : '/'}${url}`;
}

/** Absolute poster urls, the widest first. Signed urls are never used here, so old shares keep working. */
export function thumbnailUrls(origin: string, thumbnail: Thumb | undefined): string[] {
  if (!thumbnail) return [];
  const sized = (thumbnail.srcSet ?? '')
    .split(',')
    .map((part) => part.trim().split(/\s+/))
    .map(([url, size]) => ({ url: url ?? '', width: Number.parseInt(size ?? '', 10) }))
    .filter((e) => e.url && Number.isFinite(e.width))
    .sort((a, b) => b.width - a.width)
    .map((e) => abs(origin, e.url));
  return sized.length > 0 ? sized : [abs(origin, thumbnail.src)];
}

/** Same limit as og:description and the meta description (lib/seo/metadata.ts). */
const DESCRIPTION_LIMIT = 160;

function withShareImage(origin: string, shareImage: string | undefined, rest: string[]): string[] {
  if (!shareImage) return rest;
  const url = abs(origin, shareImage);
  return [url, ...rest.filter((r) => r !== url)];
}

function crumbs(category: { slug: string; name: string }, last: { name: string; path: string }) {
  return [
    { name: 'Home', path: '/' },
    ...(category.slug && category.name
      ? [{ name: category.name, path: `/browse/${encodeURIComponent(category.slug)}` }]
      : []),
    last,
  ];
}

/** Blocks for a title page. Empty when there is no absolute origin to build urls from. */
export function titlePageJsonLd(input: {
  origin: string | undefined;
  siteName: string;
  video: VideoSummary;
  /** The share picture path or url. It leads the picture list so structured data and Open Graph agree. */
  shareImage?: string;
  /** The share card words (lib/seo/share-overrides.ts), so the name and description equal og:title and og:description. */
  words?: { title: string; description: string };
}): Block[] {
  const { origin, video } = input;
  if (!origin) return [];
  const object = videoObject({
    origin,
    slug: video.slug,
    title: input.words?.title ?? video.title,
    description: trimWords(input.words?.description ?? video.description, DESCRIPTION_LIMIT),
    thumbnails: withShareImage(origin, input.shareImage, thumbnailUrls(origin, video.thumbnail)),
    uploadDate: video.publishedAt,
    durationSeconds: video.durationSeconds,
    publisher: { name: input.siteName },
  });
  const crumb = breadcrumbList(
    origin,
    crumbs(
      { slug: video.categorySlug, name: video.categoryName },
      { name: video.title, path: `/title/${encodeURIComponent(video.slug)}` },
    ),
  );
  return [...(object ? [object] : []), crumb];
}

export function seriesPageJsonLd(input: {
  origin: string | undefined;
  series: SeriesSummary;
  seasons: SeriesDetail['seasons'];
  shareImage?: string;
  words?: { title: string; description: string };
}): Block[] {
  const { origin, series } = input;
  if (!origin) return [];
  const episodes = input.seasons.flatMap((season) =>
    season.episodes.map((e) => ({
      name: e.video.title,
      episodeNumber: e.number,
      path: `/watch/${e.video.id}`,
    })),
  );
  return [
    tvSeries({
      origin,
      slug: series.slug,
      title: input.words?.title ?? series.title,
      description: trimWords(input.words?.description ?? series.description, DESCRIPTION_LIMIT),
      thumbnails: withShareImage(origin, input.shareImage, thumbnailUrls(origin, series.thumbnail)),
      episodes,
      numberOfEpisodes: series.episodeCount,
    }),
    breadcrumbList(
      origin,
      crumbs(
        { slug: series.categorySlug, name: series.categoryName },
        { name: series.title, path: `/series/${encodeURIComponent(series.slug)}` },
      ),
    ),
  ];
}

export function homePageJsonLd(input: {
  origin: string | undefined;
  name: string;
  search: boolean;
  logoUrl?: string;
  /** The X handle from settings, with or without the at sign. */
  twitterHandle?: string;
}): Block[] {
  if (!input.origin) return [];
  const handle = (input.twitterHandle ?? '').trim().replace(/^@+/, '');
  return [
    webSiteJsonLd({ origin: input.origin, name: input.name, search: input.search }),
    organizationJsonLd({
      origin: input.origin,
      name: input.name,
      logoUrl: input.logoUrl ? abs(input.origin, input.logoUrl) : undefined,
      sameAs: /^[A-Za-z0-9_]{1,15}$/.test(handle) ? [`https://x.com/${handle}`] : undefined,
    }),
  ];
}

export function categoryPageJsonLd(input: {
  origin: string | undefined;
  name: string;
  slug: string;
}): Block[] {
  if (!input.origin) return [];
  return [
    breadcrumbList(input.origin, [
      { name: 'Home', path: '/' },
      { name: input.name, path: `/browse/${encodeURIComponent(input.slug)}` },
    ]),
  ];
}
