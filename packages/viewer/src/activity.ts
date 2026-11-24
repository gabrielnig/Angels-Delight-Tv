import { and, desc, eq, sql } from 'drizzle-orm';
import { auditLog, watchProgress, watchProgressRemovals, withAccount } from '@ad/db';
import { isUuid, NotFound, type Actor } from '@ad/shared';
import { fetchVideoCards } from '@ad/catalog';
import { catalogContext, clockOf, type ViewerContext } from './context';
import { audienceOf, loadOwnedProfile } from './profiles';
import { removeProgress } from './progress';

export const ACTIVITY_PAGE_SIZE = 25;
const MAX_PAGE = 50;
/** How many raw rows to read per round when unpublished titles are being skipped. */
const SCAN = 100;
const MAX_ROUNDS = 4;

export interface ActivityItem {
  videoId: string;
  title: string;
  /** Set for an episode: the series name, so each episode watched reads as part of it (M49-S09 edge). */
  seriesTitle: string | null;
  /** For example "S1 E3". */
  episodeLabel: string | null;
  slug: string;
  posterUrl: string | null;
  posterAlt: string | null;
  watchedAt: string;
  completed: boolean;
  /** Whole percent, 0 to 100. */
  progressPct: number;
}

export interface ActivityPage {
  items: ActivityItem[];
  nextCursor: string | null;
}

function encodeCursor(updatedAt: Date, videoId: string): string {
  return Buffer.from(`${updatedAt.toISOString()}|${videoId}`).toString('base64url');
}

function decodeCursor(cursor: string): { at: Date; id: string } | null {
  try {
    const [iso, id] = Buffer.from(cursor, 'base64url').toString('utf8').split('|');
    const at = new Date(iso ?? '');
    return Number.isNaN(at.getTime()) || !id || !isUuid(id) ? null : { at, id };
  } catch {
    return null;
  }
}

/**
 * The profile's `watch_progress` table seen as history (D-L10-07): newest first, keyset paged, published titles only.
 * An unpublished title is skipped but its row stays until the viewer clears it.
 */
export async function listActivity(
  ctx: ViewerContext,
  actor: Actor,
  input: { profileId: string; cursor?: string; limit?: number },
): Promise<ActivityPage> {
  const limit = Math.min(Math.max(1, input.limit ?? ACTIVITY_PAGE_SIZE), MAX_PAGE);
  return withAccount(ctx.db, actor, async (tx) => {
    const profile = await loadOwnedProfile(tx, actor, input.profileId);
    const audience = audienceOf(profile);
    let after = input.cursor ? decodeCursor(input.cursor) : null;
    if (input.cursor && !after) throw new NotFound('Page not found');
    const items: ActivityItem[] = [];
    let lastRow: { updatedAt: Date; videoId: string } | null = null;
    let exhausted = false;

    for (let round = 0; round < MAX_ROUNDS && items.length <= limit && !exhausted; round++) {
      const rows = await tx
        .select()
        .from(watchProgress)
        .where(
          and(
            eq(watchProgress.profileId, profile.id),
            after
              ? sql`(${watchProgress.updatedAt}, ${watchProgress.videoId}) < (${after.at.toISOString()}::timestamptz, ${after.id}::uuid)`
              : undefined,
          ),
        )
        .orderBy(desc(watchProgress.updatedAt), desc(watchProgress.videoId))
        .limit(SCAN);
      if (rows.length < SCAN) exhausted = true;
      const cards = await fetchVideoCards(
        tx,
        catalogContext(ctx),
        audience,
        rows.map((r) => r.videoId),
      );
      for (const row of rows) {
        lastRow = { updatedAt: row.updatedAt, videoId: row.videoId };
        const card = cards.get(row.videoId);
        if (!card) continue;
        items.push({
          videoId: row.videoId,
          title: card.title,
          seriesTitle: card.episode?.seriesTitle ?? null,
          episodeLabel: card.episode
            ? `S${card.episode.seasonNumber} E${card.episode.number}`
            : null,
          slug: card.slug,
          posterUrl: card.poster?.variants?.[0]?.url ?? null,
          posterAlt: card.poster?.alt ?? null,
          watchedAt: row.updatedAt.toISOString(),
          completed: row.completed,
          progressPct: row.completed
            ? 100
            : row.durationMs > 0
              ? Math.min(100, Math.round((row.positionMs / row.durationMs) * 100))
              : 0,
        });
        if (items.length > limit) break;
      }
      after = lastRow ? { at: lastRow.updatedAt, id: lastRow.videoId } : after;
    }

    const page = items.slice(0, limit);
    const more = items.length > limit || (!exhausted && page.length === limit);
    const tail = page[page.length - 1];
    return {
      items: page,
      nextCursor: more && tail ? encodeCursor(new Date(tail.watchedAt), tail.videoId) : null,
    };
  });
}

/** One entry out of the list and out of Continue Watching in one step, with the same undo window (M09-S07). */
export async function removeActivity(
  ctx: ViewerContext,
  actor: Actor,
  input: { profileId: string; videoId: string },
): Promise<void> {
  await removeProgress(ctx, actor, input);
}

/** Deletes every progress row for the profile and its undo rows. The audit entry holds a count and nothing else. */
export async function clearActivity(
  ctx: ViewerContext,
  actor: Actor,
  input: { profileId: string },
): Promise<{ cleared: number }> {
  const now = clockOf(ctx);
  return withAccount(ctx.db, actor, async (tx) => {
    const profile = await loadOwnedProfile(tx, actor, input.profileId);
    const removed = await tx
      .delete(watchProgress)
      .where(eq(watchProgress.profileId, profile.id))
      .returning({ videoId: watchProgress.videoId });
    await tx.delete(watchProgressRemovals).where(eq(watchProgressRemovals.profileId, profile.id));
    await tx.insert(auditLog).values({
      occurredAt: now,
      actorAccountId: actor.accountId,
      actorRole: actor.role,
      action: 'viewer.activity_cleared',
      targetType: 'profile',
      targetId: profile.id,
      outcome: 'success',
      metadata: { count: removed.length },
    });
    return { cleared: removed.length };
  });
}
