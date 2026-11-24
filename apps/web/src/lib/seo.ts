import type { Metadata } from 'next';
import type { Thumb } from './data';

export interface ShareImage {
  url: string;
  width?: number;
  height?: number;
}

/** The widest picture in a srcset. Posters are 16 by 9, so the height follows from the width. */
export function largestImage(thumbnail: Thumb | undefined): ShareImage | null {
  if (!thumbnail) return null;
  const sized = (thumbnail.srcSet ?? '')
    .split(',')
    .map((part) => part.trim().split(/\s+/))
    .map(([url, size]) => ({ url: url ?? '', width: Number.parseInt(size ?? '', 10) }))
    .filter((entry) => entry.url && Number.isFinite(entry.width))
    .sort((a, b) => b.width - a.width)[0];
  if (!sized) return { url: thumbnail.src };
  return { url: sized.url, width: sized.width, height: Math.round((sized.width * 9) / 16) };
}

const DESCRIPTION_LIMIT = 200;

function short(text: string): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= DESCRIPTION_LIMIT) return clean;
  return `${clean.slice(0, DESCRIPTION_LIMIT - 1).trimEnd()}…`;
}

/**
 * Metadata for a title or series page that a signed out visitor can open. Link previews in chat apps read it, so
 * it names the page, the site and a picture. Nothing here depends on who is looking (M04-S04).
 */
export function previewMetadata(input: {
  kind: 'video' | 'series';
  title: string;
  description: string;
  path: string;
  siteName?: string;
  thumbnail?: Thumb;
  durationSeconds?: number;
  /** False for a kids only title: search engines are asked to skip it (R26). Default true. */
  indexable?: boolean;
  /** Path of the generated 1200 by 630 share picture (/og/title/<slug>?v=<hash>). Wins over the poster. */
  shareImagePath?: string;
}): Metadata {
  const description = short(input.description);
  const image: ShareImage | null = input.shareImagePath
    ? { url: input.shareImagePath, width: 1200, height: 630 }
    : largestImage(input.thumbnail);
  const images = image ? [{ ...image, alt: input.title }] : undefined;
  return {
    title: input.title,
    description,
    alternates: { canonical: input.path },
    ...(input.indexable === false ? { robots: { index: false, follow: false } } : {}),
    openGraph: {
      title: input.title,
      description,
      url: input.path,
      siteName: input.siteName,
      locale: 'en_NG',
      type: input.kind === 'video' ? 'video.other' : 'website',
      ...(images ? { images } : {}),
    },
    twitter: {
      card: images ? 'summary_large_image' : 'summary',
      title: input.title,
      description,
      ...(images ? { images: images.map((i) => i.url) } : {}),
    },
    ...(input.kind === 'video' && input.durationSeconds
      ? { other: { 'video:duration': String(input.durationSeconds) } }
      : {}),
  };
}
