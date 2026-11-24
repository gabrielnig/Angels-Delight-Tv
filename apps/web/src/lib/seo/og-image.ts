import type { Thumb } from '../data/types';

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;
/** WhatsApp silently drops previews above about 300 KB. */
export const OG_MAX_BYTES = 300_000;
export const PLACEHOLDER_OG = '/brand-icons/placeholder-og.png';

/**
 * Scrim under the title text. Four stops from the L6 design review: by the title zone the alpha is at least
 * 0.85, so white text keeps 4.5 to 1 even on a pure white poster. The ink is a neutral dark, drawn in an image
 * that has no access to theme tokens.
 */
export const SCRIM_RGB = [11, 18, 32];
export const SCRIM_STOPS = [
  { at: 0, alpha: 0 },
  { at: 38, alpha: 0.62 },
  { at: 58, alpha: 0.85 },
  { at: 100, alpha: 0.85 },
];
/** Vertical band, in percent of the height, where the title is drawn. */
export const TITLE_ZONE = { from: 65, to: 78 };

export function scrimAlphaAt(percent: number): number {
  const stops = SCRIM_STOPS;
  if (percent <= stops[0]!.at) return stops[0]!.alpha;
  for (let i = 1; i < stops.length; i++) {
    const a = stops[i - 1]!;
    const b = stops[i]!;
    if (percent <= b.at) return a.alpha + ((b.alpha - a.alpha) * (percent - a.at)) / (b.at - a.at);
  }
  return stops[stops.length - 1]!.alpha;
}

export function scrimCss(): string {
  const [r, g, b] = SCRIM_RGB;
  const parts = SCRIM_STOPS.map((s) => `rgba(${r}, ${g}, ${b}, ${s.alpha}) ${s.at}%`);
  return `linear-gradient(to bottom, ${parts.join(', ')})`;
}

const TITLE_LIMIT = 80;

/** Two lines worth of characters, cut on a word boundary. */
export function truncateTitle(title: string): string {
  const clean = title.replace(/\s+/g, ' ').trim();
  if (clean.length <= TITLE_LIMIT) return clean;
  const cut = clean.slice(0, TITLE_LIMIT - 1);
  const space = cut.lastIndexOf(' ');
  return `${(space > 20 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

function sizes(srcSet: string | undefined): { url: string; width: number }[] {
  return (srcSet ?? '')
    .split(',')
    .map((part) => part.trim().split(/\s+/))
    .map(([url, size]) => ({ url: url ?? '', width: Number.parseInt(size ?? '', 10) }))
    .filter((e) => e.url && Number.isFinite(e.width));
}

/** A jpeg at least 1200 wide when there is one (cheapest to decode), otherwise the widest picture. */
export function pickPosterUrl(thumbnail: Thumb | undefined): string | null {
  if (!thumbnail) return null;
  const jpegs = sizes(thumbnail.fallbackSrcSet).sort((a, b) => b.width - a.width);
  const big = jpegs.find((e) => e.width >= OG_WIDTH);
  if (big) return big.url;
  const widest = sizes(thumbnail.srcSet).sort((a, b) => b.width - a.width)[0];
  return widest?.url ?? thumbnail.src;
}

export function chooseOgImage(input: {
  posterUrl: string | null;
  siteDefaultUrl: string | null;
}): { kind: 'generated' } | { kind: 'default'; url: string } {
  if (input.posterUrl) return { kind: 'generated' };
  return { kind: 'default', url: input.siteDefaultUrl ?? PLACEHOLDER_OG };
}
