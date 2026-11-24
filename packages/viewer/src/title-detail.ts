import { and, eq, inArray } from 'drizzle-orm';
import { seasons, watchProgress, withAccount } from '@ad/db';
import { isUuid, NotFound, type Actor } from '@ad/shared';
import {
  findTitle,
  listEpisodes,
  relatedTitles,
  type ArtworkDto,
  type CaptionTrackDto,
  type CategoryDto,
  type TitleKind,
  type VideoCard,
} from '@ad/catalog';
import { annotateCards, type TitleCardDto } from './annotate';
import { catalogContext, rulesOf, type ViewerContext } from './context';
import { seriesPlayTarget, videoPlayTarget, type PlayTarget } from './play-target';
import { audienceOf, loadOwnedProfile } from './profiles';
import { resumeInfo, type CardProgress, type ProgressDto } from './progress';

interface TitleDetailBase {
  card: TitleCardDto;
  hero: ArtworkDto | null;
  categories: CategoryDto[];
  captionTracks: CaptionTrackDto[];
  publishedAt: string | null;
  /** "More like this", up to 12, filtered for the profile. Empty means the row is not drawn (M07-S05). */
  related: TitleCardDto[];
}

export interface VideoDetailDto extends TitleDetailBase {
  type: 'video';
  language: string | null;
  progress: ProgressDto | null;
  play: PlayTarget;
}

export interface EpisodeDto {
  video: VideoCard;
  progress: CardProgress | null;
  /** Shows the watched tick (M09-S09). */
  watched: boolean;
  /** The episode the Play button opens. The UI highlights it. */
  isCurrent: boolean;
}

export interface SeasonDto {
  number: number;
  title: string | null;
  episodes: EpisodeDto[];
}

export interface SeriesDetailDto extends TitleDetailBase {
  type: 'series';
  seasons: SeasonDto[];
  play: PlayTarget | null;
}

export interface TitleRedirectDto {
  type: 'redirect';
  to: { kind: TitleKind; slug: string; episodeId?: string };
}

export type TitleDetailDto = VideoDetailDto | SeriesDetailDto | TitleRedirectDto;

export interface TitleDetailInput {
  profileId: string;
  /** One of id or slug. The kind narrows the lookup when a video and a series share a slug. */
  id?: string;
  slug?: string;
  kind?: TitleKind;
}

/**
 * Everything the title or series page needs for one profile. Hidden and kids unsafe titles are not found, which
 * is indistinguishable from a title that never existed.
 */
export async function getTitleDetail(
  ctx: ViewerContext,
  actor: Actor,
  input: TitleDetailInput,
): Promise<TitleDetailDto> {
  const catalog = catalogContext(ctx);
  return withAccount(ctx.db, actor, async (tx) => {
    const profile = await loadOwnedProfile(tx, actor, input.profileId);
    const audience = audienceOf(profile);
    if (input.id !== undefined && !isUuid(input.id)) throw new NotFound('Title not found');
    const found = await findTitle(tx, catalog, audience, input);
    if (!found) throw new NotFound('Title not found');
    if (found.type === 'redirect') return found;

    const { title } = found;
    const [card] = await annotateCards(tx, profile.id, [title.card]);
    const related = await annotateCards(
      tx,
      profile.id,
      await relatedTitles(tx, catalog, audience, { kind: title.card.kind, id: title.card.id }),
    );
    const base = {
      card: card!,
      hero: title.hero,
      categories: title.categories,
      captionTracks: title.captionTracks,
      publishedAt: title.publishedAt,
      related,
    };

    if (title.card.kind === 'video') {
      const [row] = await tx
        .select()
        .from(watchProgress)
        .where(
          and(eq(watchProgress.profileId, profile.id), eq(watchProgress.videoId, title.card.id)),
        );
      const progress: ProgressDto | null = row
        ? {
            videoId: row.videoId,
            positionMs: row.positionMs,
            durationMs: row.durationMs,
            completed: row.completed,
            ...resumeInfo(rulesOf(ctx), row),
            updatedAt: row.updatedAt.toISOString(),
          }
        : null;
      return {
        type: 'video',
        ...base,
        language: title.language,
        progress,
        play: videoPlayTarget(ctx, title.card, row ?? null),
      };
    }

    const play = await seriesPlayTarget(tx, ctx, audience, profile.id, title.card.id);
    return {
      type: 'series',
      ...base,
      seasons: await buildSeasons(tx, ctx, audience, profile.id, title.card.id, play),
      play,
    };
  });
}

type ViewerTx = Parameters<Parameters<ViewerContext['db']['transaction']>[0]>[0];

export async function buildSeasons(
  tx: ViewerTx,
  ctx: ViewerContext,
  audience: { kids: boolean },
  profileId: string | null,
  seriesId: string,
  play: PlayTarget | null,
): Promise<SeasonDto[]> {
  const episodes =
    (await listEpisodes(tx, catalogContext(ctx), audience, [seriesId])).get(seriesId) ?? [];
  const progressRows =
    episodes.length === 0 || profileId === null
      ? []
      : await tx
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
  const progress = new Map(
    progressRows.map((row) => [
      row.videoId,
      { positionMs: row.positionMs, durationMs: row.durationMs, completed: row.completed },
    ]),
  );
  const seasonRows = await tx.select().from(seasons).where(eq(seasons.seriesId, seriesId));
  const titles = new Map(seasonRows.map((row) => [row.number, row.title]));
  const grouped = new Map<number, EpisodeDto[]>();
  for (const video of episodes) {
    const number = video.episode!.seasonNumber;
    const entry = progress.get(video.id) ?? null;
    const list = grouped.get(number) ?? [];
    list.push({
      video,
      progress: entry,
      watched: entry?.completed === true,
      isCurrent: play?.videoId === video.id,
    });
    grouped.set(number, list);
  }
  return [...grouped.entries()]
    .sort(([a], [b]) => a - b)
    .map(([number, list]) => ({ number, title: titles.get(number) ?? null, episodes: list }));
}
