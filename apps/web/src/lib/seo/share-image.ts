import type { Thumb } from '../data/types';
import { OG_HEIGHT, OG_WIDTH } from './og-image';
import type { ShareImageMeta } from './metadata';

/** Short stable hash (FNV-1a, two lanes) of everything that changes the picture. Url safe, not a secret. */
export function shareImageVersion(parts: readonly string[]): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (const ch of parts.join('\u0001')) {
    const code = ch.codePointAt(0) ?? 0;
    h1 = Math.imul(h1 ^ code, 0x01000193) >>> 0;
    h2 = Math.imul(h2 + code, 0x85ebca6b) >>> 0;
  }
  return `${h1.toString(36)}${h2.toString(36)}`.slice(0, 10);
}

/**
 * The share picture of a title or series: the stable route plus a version, so a new poster, title or setting gets
 * a new address and chat apps fetch it again. `extra` holds anything else that changes the picture (settings,
 * custom image id).
 */
export function shareImageFor(
  kind: 'title' | 'series',
  slug: string,
  title: string,
  publishedAt: string | undefined,
  thumbnail: Thumb | undefined,
  extra: readonly string[] = [],
): ShareImageMeta {
  const v = shareImageVersion([title, publishedAt ?? '', thumbnail?.src ?? '', ...extra]);
  return {
    url: `/og/${kind}/${encodeURIComponent(slug)}?v=${v}`,
    width: OG_WIDTH,
    height: OG_HEIGHT,
    type: 'image/jpeg',
    alt: thumbnail?.alt?.trim() || title,
  };
}
