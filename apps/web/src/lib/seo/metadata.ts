import type { Metadata } from 'next';
import { canonicalPath } from './alternates';

/** One metadata builder for every public route (lane L15b). Everything a client can word comes in through `SiteMeta`. */

export interface ShareImageMeta {
  url: string;
  width: number;
  height: number;
  type: string;
  alt?: string;
}

export interface SiteMeta {
  siteName: string;
  description: string;
  /** The platform default card. Absent only when nothing is configured and no placeholder exists. */
  defaultImage?: ShareImageMeta;
  /** Twitter handle with or without the @. Empty means no twitter:site tag. */
  twitterHandle?: string;
  /** Open Graph locale of the page, for example en_NG. */
  locale: string;
  alternateLocales: string[];
  /** False when the admin switched indexing off for the whole site. */
  indexing: boolean;
}

export type PageMeta = {
  kind: 'website' | 'video' | 'series' | 'episode' | 'private';
  path: string;
  query?: Record<string, string | undefined>;
  title?: string;
  description?: string;
  image?: ShareImageMeta;
  durationSeconds?: number;
  releasedAt?: string;
  tags?: string[];
  /** For private pages: let crawlers follow links (search results). Default false. */
  follow?: boolean;
};

export const META_DESCRIPTION_LIMIT = 160;
export const TWITTER_DESCRIPTION_LIMIT = 200;

const CONTROL = new RegExp('[\\u0000-\\u001f\\u007f\\u2028\\u2029]', 'g');

/** Plain text only: no tags, no control characters, one space between words. Quotes and diacritics stay. */
export function cleanText(input: string): string {
  return input
    .replace(/<\/?[a-zA-Z!][^>]*>/g, ' ')
    .replace(/<|>/g, '')
    .replace(CONTROL, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function graphemeSafeCut(text: string, length: number): string {
  let cut = text.slice(0, length);
  // Do not end on a lone high surrogate or inside a base letter plus combining marks.
  const next = text.charAt(length);
  if (/[̀-ͯ᪰-᫿⃐-⃿︠-︯]/.test(next) || /[\ud800-\udbff]$/.test(cut)) {
    cut = cut.replace(/[^\s]*$/u, '');
    if (!cut) cut = text.slice(0, Math.max(1, length - 2));
  }
  return cut;
}

/** At most `limit` characters including the ellipsis, cut between words. */
export function trimWords(input: string, limit: number): string {
  const text = cleanText(input);
  if (text.length <= limit) return text;
  const room = limit - 1;
  const head = graphemeSafeCut(text, room);
  const wordEnds = /\s/.test(text.charAt(head.length));
  const space = head.lastIndexOf(' ');
  const base = wordEnds ? head : space > Math.floor(room / 3) ? head.slice(0, space) : head;
  return `${base.trimEnd().replace(/[,;:.\s-]+$/u, '')}…`;
}

export function ogLocale(htmlLang: string): string {
  const [language, region] = htmlLang.replace('_', '-').split('-');
  if (!language) return 'en_NG';
  return `${language.toLowerCase()}_${(region ?? 'NG').toUpperCase()}`;
}

function handleOf(raw: string | undefined): string | undefined {
  const clean = (raw ?? '').trim().replace(/^@+/, '');
  return /^[A-Za-z0-9_]{1,15}$/.test(clean) ? `@${clean}` : undefined;
}

const OG_TYPE = {
  website: 'website',
  video: 'video.other',
  series: 'video.tv_show',
  episode: 'video.episode',
  private: 'website',
} as const;

export function buildMetadata(site: SiteMeta, page: PageMeta): Metadata {
  const isPrivate = page.kind === 'private';
  const title = page.title ? cleanText(page.title) : '';
  const shownTitle = title || site.siteName;
  const description = trimWords(page.description || site.description, META_DESCRIPTION_LIMIT);
  const twitterDescription = trimWords(page.description || site.description, TWITTER_DESCRIPTION_LIMIT);
  const path = canonicalPath(page.path, page.query);
  const image = page.image ?? site.defaultImage;
  const images = image ? [{ ...image, alt: cleanText(image.alt ?? shownTitle) }] : undefined;
  const handle = handleOf(site.twitterHandle);
  const noindex = isPrivate || !site.indexing;
  const video = page.kind === 'video' || page.kind === 'episode' || page.kind === 'series';
  return {
    title: title ? title : { absolute: site.siteName },
    description,
    ...(isPrivate ? {} : { alternates: { canonical: path } }),
    ...(noindex ? { robots: { index: false, follow: isPrivate ? Boolean(page.follow) : false } } : {}),
    openGraph: {
      title: shownTitle,
      description,
      url: path,
      siteName: site.siteName,
      locale: site.locale,
      ...(site.alternateLocales.length > 0 ? { alternateLocale: site.alternateLocales } : {}),
      type: OG_TYPE[page.kind],
      ...(video && page.kind !== 'series' && page.durationSeconds ? { duration: page.durationSeconds } : {}),
      ...(video && page.releasedAt ? { releaseDate: page.releasedAt } : {}),
      ...(video && page.tags && page.tags.length > 0 ? { tags: page.tags.map(cleanText) } : {}),
      ...(images ? { images } : {}),
    } as NonNullable<Metadata['openGraph']>,
    twitter: {
      card: images ? 'summary_large_image' : 'summary',
      title: shownTitle,
      description: twitterDescription,
      ...(handle ? { site: handle } : {}),
      ...(images ? { images: images.map((i) => ({ url: i.url, alt: i.alt })) } : {}),
    },
  };
}
