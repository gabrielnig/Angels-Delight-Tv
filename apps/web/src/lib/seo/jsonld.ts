/**
 * Pure builders for structured data (M45-S02). Every builder omits a field that has no value instead of emitting
 * an empty string, and none of them ever writes a rating: no ratings exist and made up ones break search
 * engine policy (D-L6-7).
 */

type Json = Record<string, unknown>;

const DESCRIPTION_LIMIT = 5000;
export const MAX_SERIES_EPISODES = 50;

function plain(text: string | undefined): string | undefined {
  if (!text) return undefined;
  const clean = text
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!clean) return undefined;
  return clean.length > DESCRIPTION_LIMIT ? clean.slice(0, DESCRIPTION_LIMIT) : clean;
}

function absolute(origin: string, path: string): string {
  return `${origin.replace(/\/+$/, '')}${path}`;
}

/** ISO 8601 duration such as PT12M34S. */
export function isoDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `PT${h ? `${h}H` : ''}${m ? `${m}M` : ''}${s || (!h && !m) ? `${s}S` : ''}`;
}

function compact(data: Json): Json {
  return Object.fromEntries(
    Object.entries(data).filter(([, v]) => v !== undefined && v !== null && v !== ''),
  );
}

export interface Publisher {
  name: string;
  logoUrl?: string;
}

function publisherOf(publisher: Publisher | undefined): Json | undefined {
  if (!publisher?.name) return undefined;
  return compact({
    '@type': 'Organization',
    name: publisher.name,
    logo: publisher.logoUrl ? { '@type': 'ImageObject', url: publisher.logoUrl } : undefined,
  });
}

export interface VideoInput {
  origin: string;
  slug: string;
  title: string;
  description?: string;
  thumbnails: string[];
  uploadDate: string;
  durationSeconds?: number;
  language?: string;
  publisher?: Publisher;
}

/**
 * The media is signed and short lived, so `contentUrl` is never set. `embedUrl` is the title page. Returns null
 * when a field Google requires (name, thumbnail, upload date) is missing, so the page renders without it.
 */
export function videoObject(input: VideoInput): Json | null {
  if (!input.title.trim() || input.thumbnails.length === 0 || !input.uploadDate) return null;
  return compact({
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: input.title.trim(),
    description: plain(input.description),
    thumbnailUrl: input.thumbnails,
    uploadDate: input.uploadDate,
    duration:
      input.durationSeconds && input.durationSeconds > 0
        ? isoDuration(input.durationSeconds)
        : undefined,
    embedUrl: absolute(input.origin, `/title/${encodeURIComponent(input.slug)}`),
    isAccessibleForFree: true,
    inLanguage: input.language,
    publisher: publisherOf(input.publisher),
  });
}

export interface EpisodeInput {
  name: string;
  episodeNumber: number;
  path: string;
}

export function tvSeries(input: {
  origin: string;
  slug: string;
  title: string;
  description?: string;
  thumbnails?: string[];
  episodes: EpisodeInput[];
  numberOfEpisodes?: number;
}): { episode?: Json[] } & Json {
  const episodes = input.episodes.slice(0, MAX_SERIES_EPISODES).map((e) =>
    compact({
      '@type': 'TVEpisode',
      name: e.name,
      episodeNumber: e.episodeNumber,
      url: absolute(input.origin, e.path),
    }),
  );
  return compact({
    '@context': 'https://schema.org',
    '@type': 'TVSeries',
    name: input.title,
    description: plain(input.description),
    url: absolute(input.origin, `/series/${encodeURIComponent(input.slug)}`),
    image: input.thumbnails && input.thumbnails.length > 0 ? input.thumbnails : undefined,
    numberOfEpisodes: input.numberOfEpisodes ?? input.episodes.length,
    episode: episodes.length > 0 ? episodes : undefined,
  }) as { episode?: Json[] } & Json;
}

export function breadcrumbList(
  origin: string,
  crumbs: { name: string; path: string }[],
): { itemListElement: { position: number; item: string }[] } & Json {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((crumb, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: crumb.name,
      item: absolute(origin, crumb.path),
    })),
  };
}

export function webSiteJsonLd(input: { origin: string; name: string; search: boolean }): Json {
  return compact({
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: input.name,
    url: input.origin,
    potentialAction: input.search
      ? {
          '@type': 'SearchAction',
          target: `${absolute(input.origin, '/search')}?q={search_term_string}`,
          'query-input': 'required name=search_term_string',
        }
      : undefined,
  });
}

export function organizationJsonLd(input: {
  origin: string;
  name: string;
  logoUrl?: string;
}): Json {
  return compact({
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: input.name,
    url: input.origin,
    logo: input.logoUrl,
  });
}

/** JSON for a script tag. `<`, `>`, `&` and the two line separators are escaped so no title can end the tag. */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replaceAll(String.fromCharCode(0x2028), '\\u2028')
    .replaceAll(String.fromCharCode(0x2029), '\\u2029');
}
