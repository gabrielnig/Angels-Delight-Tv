import type { TitleCardDto } from '@ad/viewer';
import type { Progress, VideoSummary } from '../data/types';
import { toThumb } from '../media/to-thumb';
import { GUEST_RESUME_MIN_SECONDS } from './resume';
import type { GuestProgressItem } from './progress-store';

/** Videos worth offering again: started, not finished, newest first, no more than one batch lookup takes. */
export function pickContinueEntries(
  items: GuestProgressItem[],
  limit: number,
): GuestProgressItem[] {
  return items
    .filter((item) => !item.f && item.p >= GUEST_RESUME_MIN_SECONDS)
    .sort((a, b) => b.t - a.t)
    .slice(0, limit);
}

function toVideo(card: TitleCardDto): VideoSummary {
  return {
    kind: 'video',
    id: card.id,
    slug: card.slug,
    title: card.title,
    description: card.description ?? '',
    durationSeconds: Math.round((card.durationMs ?? 0) / 1000),
    categorySlug: card.categorySlug ?? '',
    categoryName: card.categoryName ?? '',
    thumbnail: toThumb(card.poster),
    hasCaptions: card.hasCaptions,
    kidsSafe: card.kidsSafe,
    publishedAt: card.publishedAt ?? '',
  };
}

/** Joins what the device remembers with the cards the server still shows. A video that is gone is dropped. */
export function buildContinueItems(
  entries: GuestProgressItem[],
  cards: TitleCardDto[],
): Array<{ video: VideoSummary; progress: Progress }> {
  const byId = new Map(cards.filter((c) => c.kind === 'video').map((c) => [c.id, c]));
  return entries.flatMap((entry) => {
    const card = byId.get(entry.videoId);
    if (!card) return [];
    return [
      {
        video: toVideo(card),
        progress: {
          videoId: entry.videoId,
          positionSeconds: entry.p,
          durationSeconds: entry.d,
          updatedAt: new Date(entry.t).toISOString(),
        },
      },
    ];
  });
}
