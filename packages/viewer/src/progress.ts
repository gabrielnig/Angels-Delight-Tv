import { and, desc, eq, gte, inArray, sql } from 'drizzle-orm';
import type { profiles } from '@ad/db';
import { watchProgress, watchProgressRemovals, withAccount } from '@ad/db';
import { isUuid, NotFound, positionCode, resolveSeriesLabels, type Actor } from '@ad/shared';
import {
  episodeOrder,
  fetchVideoCards,
  listEpisodes,
  playableVideoSql,
  rowsOf,
  type VideoCard,
} from '@ad/catalog';
import { catalogContext, clockOf, rulesOf, spendAttempt, type ViewerContext } from './context';
import { audienceOf, loadOwnedProfile } from './profiles';
import type { ViewerRules } from './rules';

type ProgressRow = typeof watchProgress.$inferSelect;
type ViewerTx = Parameters<Parameters<ViewerContext['db']['transaction']>[0]>[0];

export type PlayLabel = 'play' | 'resume' | 'watch_again';

export interface ProgressDto {
  videoId: string;
  positionMs: number;
  durationMs: number;
  completed: boolean;
  /** Where playback should start: the saved position minus the rewind, or 0 (M09-S04). */
  resumeFromMs: number;
  label: PlayLabel;
  updatedAt: string;
}

/** The small progress shape that cards carry for the bar and the watched tick. */
export interface CardProgress {
  positionMs: number;
  durationMs: number;
  completed: boolean;
}

export interface SaveProgressInput {
  profileId: string;
  videoId: string;
  positionMs: number;
  /** When the position was observed on the device. Used only when it is close to server time. */
  clientTimestamp?: string;
  /** The viewer jumped on purpose, so a backward move is real. */
  seek?: boolean;
  /** The player reported the end of the video. */
  ended?: boolean;
}

export interface ContinueWatchingItem {
  video: VideoCard;
  /** 0 for a next-up episode that has not been started. */
  positionMs: number;
  durationMs: number;
  resumeFromMs: number;
  /** True when the card is the next episode after a finished one (shown as "Next: E4"). */
  nextUp: boolean;
  /** "S1 E4" for an episode, null for a standalone video. */
  episodeLabel: string | null;
  /** The video whose progress record backs this card. Pass it to removeProgress for "Remove from row". */
  progressVideoId: string;
  updatedAt: string;
}

const HISTORY_SCAN_LIMIT = 200;

function episodeLabelOf(card: VideoCard): string | null {
  return card.episode
    ? positionCode(resolveSeriesLabels(card.episode.labels, null), card.episode.seasonNumber, card.episode.number)
    : null;
}

export function isFinished(rules: ViewerRules, positionMs: number, durationMs: number): boolean {
  return (
    positionMs >= durationMs * rules.finishedFraction ||
    durationMs - positionMs <= rules.finishedRemainingMs
  );
}

export function resumeInfo(
  rules: ViewerRules,
  row: Pick<ProgressRow, 'positionMs' | 'completed'>,
): { resumeFromMs: number; label: PlayLabel } {
  if (row.completed) return { resumeFromMs: 0, label: 'watch_again' };
  if (row.positionMs < rules.minProgressMs) return { resumeFromMs: 0, label: 'play' };
  return { resumeFromMs: Math.max(0, row.positionMs - rules.resumeRewindMs), label: 'resume' };
}

function toDto(rules: ViewerRules, row: ProgressRow): ProgressDto {
  return {
    videoId: row.videoId,
    positionMs: row.positionMs,
    durationMs: row.durationMs,
    completed: row.completed,
    ...resumeInfo(rules, row),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Client time is trusted only inside the skew window, and never from the future. */
function effectiveTimestamp(clientTimestamp: string | undefined, now: Date, skewMs: number): Date {
  if (clientTimestamp === undefined) return now;
  const parsed = new Date(clientTimestamp);
  if (Number.isNaN(parsed.getTime()) || Math.abs(parsed.getTime() - now.getTime()) > skewMs) {
    return now;
  }
  return parsed.getTime() > now.getTime() ? now : parsed;
}

async function requirePlayableDuration(
  tx: ViewerTx,
  ctx: ViewerContext,
  audience: { kids: boolean },
  videoId: string,
): Promise<number> {
  if (!isUuid(videoId)) throw new NotFound('Video not found');
  const result = await tx.execute(
    sql`SELECT v.duration_ms FROM videos v WHERE v.id = ${videoId}::uuid AND ${playableVideoSql('v', audience, clockOf(ctx))}`,
  );
  const row = rowsOf<{ duration_ms: number }>(result)[0];
  if (!row) throw new NotFound('Video not found');
  return row.duration_ms;
}

/**
 * Saves where a profile is in a video. Applies the start and finish thresholds, resolves writes from two devices
 * and always scopes to the actor's own profile. Returns the stored progress after the call, or null when the
 * position is too early to be remembered (M09-S02).
 */
export async function saveProgress(
  ctx: ViewerContext,
  actor: Actor,
  input: SaveProgressInput,
): Promise<ProgressDto | null> {
  const rules = rulesOf(ctx);
  const now = clockOf(ctx);

  return withAccount(ctx.db, actor, async (tx) => {
    const profile = await loadOwnedProfile(tx, actor, input.profileId);
    await spendAttempt(ctx, 'progress', profile.id);
    const durationMs = await requirePlayableDuration(tx, ctx, audienceOf(profile), input.videoId);
    const positionMs = Math.min(Math.max(Math.trunc(input.positionMs), 0), durationMs);
    const timestamp = effectiveTimestamp(input.clientTimestamp, now, rules.maxClockSkewMs);
    const finished = input.ended === true || isFinished(rules, positionMs, durationMs);

    const [existing] = await tx
      .select()
      .from(watchProgress)
      .where(and(eq(watchProgress.profileId, profile.id), eq(watchProgress.videoId, input.videoId)))
      .for('update');

    if (finished) {
      const values = {
        profileId: profile.id,
        videoId: input.videoId,
        positionMs: 0,
        durationMs,
        completed: true,
        completedAt: timestamp,
        updatedAt: timestamp,
      };
      const [saved] = await tx
        .insert(watchProgress)
        .values(values)
        .onConflictDoUpdate({
          target: [watchProgress.profileId, watchProgress.videoId],
          set: values,
        })
        .returning();
      return toDto(rules, saved!);
    }

    if (positionMs < rules.minProgressMs) return existing ? toDto(rules, existing) : null;

    if (existing) {
      const stale = existing.updatedAt.getTime() >= timestamp.getTime();
      const jumpedBack =
        !input.seek &&
        !existing.completed &&
        positionMs < existing.positionMs - rules.backwardJumpMs &&
        now.getTime() - existing.updatedAt.getTime() < rules.backwardGuardWindowMs;
      if (stale || jumpedBack) return toDto(rules, existing);
    }

    const values = {
      profileId: profile.id,
      videoId: input.videoId,
      positionMs,
      durationMs,
      completed: false,
      completedAt: null,
      updatedAt: timestamp,
    };
    const [saved] = await tx
      .insert(watchProgress)
      .values(values)
      .onConflictDoUpdate({
        target: [watchProgress.profileId, watchProgress.videoId],
        set: values,
        setWhere: sql`${watchProgress.updatedAt} < ${timestamp}::timestamptz`,
      })
      .returning();
    if (saved) return toDto(rules, saved);
    const [current] = await tx
      .select()
      .from(watchProgress)
      .where(
        and(eq(watchProgress.profileId, profile.id), eq(watchProgress.videoId, input.videoId)),
      );
    return current ? toDto(rules, current) : null;
  });
}

export async function getProgress(
  ctx: ViewerContext,
  actor: Actor,
  input: { profileId: string; videoId: string },
): Promise<ProgressDto | null> {
  const rules = rulesOf(ctx);
  return withAccount(ctx.db, actor, async (tx) => {
    const profile = await loadOwnedProfile(tx, actor, input.profileId);
    await requirePlayableDuration(tx, ctx, audienceOf(profile), input.videoId);
    const [row] = await tx
      .select()
      .from(watchProgress)
      .where(
        and(eq(watchProgress.profileId, profile.id), eq(watchProgress.videoId, input.videoId)),
      );
    return row ? toDto(rules, row) : null;
  });
}

/** How long Undo works after "Remove from row". The toast is shorter, this covers a slow tap or a reload. */
export const PROGRESS_UNDO_WINDOW_MS = 5 * 60_000;

/**
 * "Remove from row" (M09-S07): forgets the position so the title starts from the beginning. The old position is
 * kept in the database for the undo window, so Undo works on any server and after a restart. `requestedId` is the
 * id the card carried, which for an episode can be the series, and defaults to the video.
 */
export async function removeProgress(
  ctx: ViewerContext,
  actor: Actor,
  input: { profileId: string; videoId: string; requestedId?: string },
): Promise<void> {
  const now = clockOf(ctx);
  await withAccount(ctx.db, actor, async (tx) => {
    const profile = await loadOwnedProfile(tx, actor, input.profileId);
    if (!isUuid(input.videoId)) return;
    const [existing] = await tx
      .select()
      .from(watchProgress)
      .where(and(eq(watchProgress.profileId, profile.id), eq(watchProgress.videoId, input.videoId)))
      .for('update');
    await tx
      .delete(watchProgressRemovals)
      .where(
        and(
          eq(watchProgressRemovals.profileId, profile.id),
          sql`${watchProgressRemovals.removedAt} < ${new Date(now.getTime() - PROGRESS_UNDO_WINDOW_MS).toISOString()}::timestamptz`,
        ),
      );
    if (!existing) return;
    if (existing.positionMs > 0) {
      const requestedId =
        input.requestedId !== undefined && isUuid(input.requestedId)
          ? input.requestedId
          : input.videoId;
      const values = {
        profileId: profile.id,
        requestedId,
        videoId: input.videoId,
        positionMs: existing.positionMs,
        removedAt: now,
      };
      await tx
        .insert(watchProgressRemovals)
        .values(values)
        .onConflictDoUpdate({
          target: [watchProgressRemovals.profileId, watchProgressRemovals.requestedId],
          set: values,
        });
    }
    await tx
      .delete(watchProgress)
      .where(
        and(eq(watchProgress.profileId, profile.id), eq(watchProgress.videoId, input.videoId)),
      );
  });
}

/**
 * Undo of "Remove from row". Puts the saved position back when the undo window is open and nothing newer was
 * watched since. Returns false when there is nothing to restore, so the screen can say so. An undo can be used once.
 */
export async function restoreProgress(
  ctx: ViewerContext,
  actor: Actor,
  input: { profileId: string; requestedId: string },
): Promise<boolean> {
  const rules = rulesOf(ctx);
  const now = clockOf(ctx);
  return withAccount(ctx.db, actor, async (tx) => {
    const profile = await loadOwnedProfile(tx, actor, input.profileId);
    if (!isUuid(input.requestedId)) return false;
    const [removal] = await tx
      .select()
      .from(watchProgressRemovals)
      .where(
        and(
          eq(watchProgressRemovals.profileId, profile.id),
          eq(watchProgressRemovals.requestedId, input.requestedId),
        ),
      )
      .for('update');
    if (!removal) return false;
    await tx
      .delete(watchProgressRemovals)
      .where(
        and(
          eq(watchProgressRemovals.profileId, profile.id),
          eq(watchProgressRemovals.requestedId, input.requestedId),
        ),
      );
    if (now.getTime() - removal.removedAt.getTime() > PROGRESS_UNDO_WINDOW_MS) return false;
    const [newer] = await tx
      .select({ updatedAt: watchProgress.updatedAt })
      .from(watchProgress)
      .where(
        and(eq(watchProgress.profileId, profile.id), eq(watchProgress.videoId, removal.videoId)),
      );
    if (newer) return false;
    let durationMs: number;
    try {
      durationMs = await requirePlayableDuration(tx, ctx, audienceOf(profile), removal.videoId);
    } catch (error) {
      if (error instanceof NotFound) return false;
      throw error;
    }
    const positionMs = Math.min(removal.positionMs, durationMs);
    if (positionMs < rules.minProgressMs) return false;
    await tx.insert(watchProgress).values({
      profileId: profile.id,
      videoId: removal.videoId,
      positionMs,
      durationMs,
      completed: false,
      completedAt: null,
      updatedAt: now,
    });
    return true;
  });
}

/** Progress of one profile for a set of videos, for the bar and tick on cards. Caller has verified the profile. */
export async function progressForVideos(
  tx: ViewerTx,
  profileId: string,
  videoIds: readonly string[],
): Promise<Map<string, CardProgress>> {
  if (videoIds.length === 0) return new Map();
  const rows = await tx
    .select()
    .from(watchProgress)
    .where(
      and(eq(watchProgress.profileId, profileId), inArray(watchProgress.videoId, [...videoIds])),
    );
  return new Map(
    rows.map((row) => [
      row.videoId,
      { positionMs: row.positionMs, durationMs: row.durationMs, completed: row.completed },
    ]),
  );
}

/**
 * The Continue Watching row for one profile: unfinished titles most recent first, one card per series, and the
 * next episode in place of a finished one (M09-S01, M09-S05). Visibility is applied by the catalog queries, so a
 * title that was unpublished or is not kids safe simply does not appear while its history stays stored.
 */
export async function continueWatching(
  ctx: ViewerContext,
  actor: Actor,
  input: { profileId: string },
): Promise<ContinueWatchingItem[]> {
  return withAccount(ctx.db, actor, async (tx) =>
    loadContinueWatching(tx, ctx, await loadOwnedProfile(tx, actor, input.profileId)),
  );
}

/** The row for a profile the caller has already verified, so Home can reuse its own transaction. */
export async function loadContinueWatching(
  tx: ViewerTx,
  ctx: ViewerContext,
  profile: Pick<typeof profiles.$inferSelect, 'id' | 'isKids' | 'maxMaturityRank'>,
): Promise<ContinueWatchingItem[]> {
  const rules = rulesOf(ctx);
  const now = clockOf(ctx);
  const audience = audienceOf(profile);
  const cutoff =
    rules.continueWatchingMaxAgeDays === null
      ? null
      : new Date(now.getTime() - rules.continueWatchingMaxAgeDays * 24 * 3600 * 1000);

  const rows = await tx
    .select()
    .from(watchProgress)
    .where(
      and(
        eq(watchProgress.profileId, profile.id),
        cutoff ? gte(watchProgress.updatedAt, cutoff) : undefined,
      ),
    )
    .orderBy(desc(watchProgress.updatedAt))
    .limit(HISTORY_SCAN_LIMIT);

  const cards = await fetchVideoCards(
    tx,
    catalogContext(ctx),
    audience,
    rows.map((row) => row.videoId),
  );
  const seriesIds = [
    ...new Set(
      [...cards.values()].flatMap((card) => (card.episode ? [card.episode.seriesId] : [])),
    ),
  ];
  const playableEpisodes = await listEpisodes(tx, catalogContext(ctx), audience, seriesIds);
  const orderBySeries = await episodeOrder(tx, seriesIds);
  const completedVideos = new Set(rows.filter((row) => row.completed).map((row) => row.videoId));

  const items: ContinueWatchingItem[] = [];
  const handledSeries = new Set<string>();
  for (const row of rows) {
    const card = cards.get(row.videoId);
    if (!card) continue;
    const counts = row.completed || row.positionMs >= rules.minProgressMs;
    if (!counts) continue;

    if (card.episode) {
      if (handledSeries.has(card.episode.seriesId)) continue;
      handledSeries.add(card.episode.seriesId);
    }

    if (!row.completed) {
      items.push({
        video: card,
        positionMs: row.positionMs,
        durationMs: row.durationMs,
        resumeFromMs: resumeInfo(rules, row).resumeFromMs,
        nextUp: false,
        episodeLabel: episodeLabelOf(card),
        progressVideoId: row.videoId,
        updatedAt: row.updatedAt.toISOString(),
      });
      continue;
    }

    if (!card.episode) continue;
    const order = orderBySeries.get(card.episode.seriesId) ?? [];
    const nextId = order
      .slice(order.indexOf(row.videoId) + 1)
      .find((videoId) => !completedVideos.has(videoId));
    const next = playableEpisodes
      .get(card.episode.seriesId)
      ?.find((episode) => episode.id === nextId);
    if (next) {
      items.push({
        video: next,
        positionMs: 0,
        durationMs: next.durationMs,
        resumeFromMs: 0,
        nextUp: true,
        episodeLabel: episodeLabelOf(next),
        progressVideoId: row.videoId,
        updatedAt: row.updatedAt.toISOString(),
      });
    }
  }
  return items.slice(0, rules.continueWatchingLimit);
}
