import { formatDuration, formatTimeLeft } from '@ad/ui';
import type { CatalogItem, Progress } from './data';

export const itemHref = (item: CatalogItem) =>
  item.kind === 'video' ? `/title/${item.slug}` : `/series/${item.slug}`;

export const itemKey = (item: CatalogItem) =>
  item.kind === 'video' ? `video:${item.id}` : `series:${item.id ?? item.slug}`;

export function metaLine(item: CatalogItem): string {
  const detail =
    item.kind === 'video'
      ? formatDuration(item.durationSeconds)
      : `${item.episodeCount} ${item.episodeCount === 1 ? 'episode' : 'episodes'}`;
  return item.categoryName ? `${item.categoryName}, ${detail}` : detail;
}

export function timeLeftLabel(progress: Progress): string {
  return formatTimeLeft(Math.max(0, progress.durationSeconds - progress.positionSeconds));
}

export function percent(progress: Progress): number {
  if (progress.durationSeconds <= 0) return 0;
  return Math.round((progress.positionSeconds / progress.durationSeconds) * 100);
}

/** Dates as "17 Nov 2026", never the 24 hour clock. */
export function formatDate(iso: string): string {
  const date = new Date(iso);
  return `${date.getUTCDate()} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

export function maskEmail(email: string): string {
  const [name = '', domain = ''] = email.split('@');
  return `${name.slice(0, 1)}${'*'.repeat(Math.max(3, name.length - 1))}@${domain}`;
}
