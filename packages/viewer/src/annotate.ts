import { and, eq, inArray, or } from 'drizzle-orm';
import { myList } from '@ad/db';
import type { TitleCard } from '@ad/catalog';
import type { ViewerContext } from './context';
import { progressForVideos, type CardProgress } from './progress';

type ViewerTx = Parameters<Parameters<ViewerContext['db']['transaction']>[0]>[0];

/** A card plus what this profile has done with it: the bar, the watched tick and the My List state. */
export interface TitleCardDto extends TitleCard {
  /** Videos only. A series card carries no progress of its own. */
  progress: CardProgress | null;
  inMyList: boolean;
}

/** Adds personal state to catalog cards. The caller has already verified the profile belongs to the actor. */
export async function annotateCards(
  tx: ViewerTx,
  profileId: string | null,
  cards: readonly TitleCard[],
): Promise<TitleCardDto[]> {
  if (cards.length === 0) return [];
  // The guest path (M40) has no profile: nothing personal is read, so the result carries no progress and no My List.
  if (profileId === null)
    return cards.map((card) => ({ ...card, progress: null, inMyList: false }));
  const videoIds = cards.filter((card) => card.kind === 'video').map((card) => card.id);
  const seriesIds = cards.filter((card) => card.kind === 'series').map((card) => card.id);
  const progress = await progressForVideos(tx, profileId, videoIds);
  const saved = await tx
    .select({ videoId: myList.videoId, seriesId: myList.seriesId })
    .from(myList)
    .where(
      and(
        eq(myList.profileId, profileId),
        or(
          videoIds.length > 0 ? inArray(myList.videoId, videoIds) : undefined,
          seriesIds.length > 0 ? inArray(myList.seriesId, seriesIds) : undefined,
        ),
      ),
    );
  const savedIds = new Set(saved.flatMap((row) => [row.videoId, row.seriesId]));
  return cards.map((card) => ({
    ...card,
    progress: progress.get(card.id) ?? null,
    inMyList: savedIds.has(card.id),
  }));
}
