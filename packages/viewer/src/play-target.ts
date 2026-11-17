import { and, eq, inArray } from 'drizzle-orm';
import { watchProgress } from '@ad/db';
import { listEpisodes, type Audience } from '@ad/catalog';
import { catalogContext, rulesOf, type ViewerContext } from './context';
import type { PlayLabel } from './progress';
import { resumeInfo } from './progress';

type ViewerTx = Parameters<Parameters<ViewerContext['db']['transaction']>[0]>[0];

/** What the main button of a card, hero or title page does: which video, where it starts, what it says. */
export interface PlayTarget {
  videoId: string;
  slug: string;
  startMs: number;
  label: PlayLabel;
  /** Set when the target is an episode, so the button can read "Resume S1 E3". */
  episode: { seasonNumber: number; number: number } | null;
}

/** Play, Resume or Watch again for one video (M07-S03). */
export function videoPlayTarget(
  ctx: ViewerContext,
  video: { id: string; slug: string },
  progress: { positionMs: number; completed: boolean } | null,
  episode: PlayTarget['episode'] = null,
): PlayTarget {
  const { resumeFromMs, label } = progress
    ? resumeInfo(rulesOf(ctx), progress)
    : { resumeFromMs: 0, label: 'play' as const };
  return { videoId: video.id, slug: video.slug, startMs: resumeFromMs, label, episode };
}

/**
 * The episode "Play" should open for a series: resume the one in progress, or the next unwatched one after the
 * last finished, or the first when nothing was watched. When every episode is finished it offers to watch again
 * from the first (M05-S01, M07-S03).
 */
export async function seriesPlayTarget(
  tx: ViewerTx,
  ctx: ViewerContext,
  audience: Audience,
  profileId: string,
  seriesId: string,
): Promise<PlayTarget | null> {
  const rules = rulesOf(ctx);
  const episodes =
    (await listEpisodes(tx, catalogContext(ctx), audience, [seriesId])).get(seriesId) ?? [];
  const first = episodes[0];
  if (!first) return null;
  const progress = await tx
    .select()
    .from(watchProgress)
    .where(
      and(
        eq(watchProgress.profileId, profileId),
        inArray(
          watchProgress.videoId,
          episodes.map((episode) => episode.id),
        ),
      ),
    );
  const counted = progress
    .filter((row) => row.completed || row.positionMs >= rules.minProgressMs)
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  const completed = new Set(progress.filter((row) => row.completed).map((row) => row.videoId));
  const target = (episode: (typeof episodes)[number], row: (typeof progress)[number] | null) =>
    videoPlayTarget(ctx, episode, row, {
      seasonNumber: episode.episode!.seasonNumber,
      number: episode.episode!.number,
    });

  const latest = counted[0];
  if (!latest) return target(first, null);
  const latestEpisode = episodes.find((episode) => episode.id === latest.videoId);
  if (!latestEpisode) return target(first, null);
  if (!latest.completed) return target(latestEpisode, latest);

  const next = episodes
    .slice(episodes.indexOf(latestEpisode) + 1)
    .find((episode) => !completed.has(episode.id));
  if (next) return target(next, null);
  const stillOpen = episodes.find((episode) => !completed.has(episode.id));
  if (stillOpen) return target(stillOpen, null);
  return target(first, progress.find((row) => row.videoId === first.id) ?? null);
}
