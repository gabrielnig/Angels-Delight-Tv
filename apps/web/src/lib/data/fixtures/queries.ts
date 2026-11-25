import type { CatalogItem, ViewerContext } from '../types';
import type { BrowseLength } from '../types';
import { SERIES, VIDEOS } from './catalog-data';

export const itemKey = (item: CatalogItem) =>
  item.kind === 'video' ? `video:${item.id}` : `series:${item.slug}`;

const byNewest = (a: CatalogItem, b: CatalogItem) => b.publishedAt.localeCompare(a.publishedAt);

/** Everything a profile may see, with episodes folded into their series card. */
export function listable(ctx: ViewerContext): CatalogItem[] {
  const kids = ctx.audience === 'kids';
  const videos = VIDEOS.filter((v) => !v.series && (!kids || v.kidsSafe));
  const series = SERIES.filter((s) => !kids || s.kidsSafe);
  return [...videos, ...series].sort(byNewest);
}

export function lookupItem(key: string): CatalogItem | undefined {
  const [kind, id] = key.split(':');
  if (kind === 'series') return SERIES.find((s) => s.slug === id);
  return VIDEOS.find((v) => v.id === id);
}


/**
 * The length filter, in seconds. Same edges as the catalog service (`DURATION_BUCKETS`): under 5 minutes,
 * 5 up to 15 minutes, 15 minutes and over. `length.test.ts` keeps the two in step.
 */
export function matchesLength(seconds: number, length: BrowseLength | undefined): boolean {
  if (length === 'short') return seconds < 300;
  if (length === 'medium') return seconds >= 300 && seconds < 900;
  if (length === 'long') return seconds >= 900;
  return true;
}
