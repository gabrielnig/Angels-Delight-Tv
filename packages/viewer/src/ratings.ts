import { and, eq, inArray, or, sql } from 'drizzle-orm';
import { titleRatings, withAccount } from '@ad/db';
import { Forbidden, isUuid, NotFound, ValidationFailed, type Actor } from '@ad/shared';
import { fetchCards, rowsOf, type TitleRef } from '@ad/catalog';
import { catalogContext, spendAttempt, type ViewerContext } from './context';
import { audienceOf, loadOwnedProfile } from './profiles';

export type RatingValue = -1 | 1 | 2;
export const RATING_VALUES: readonly RatingValue[] = [-1, 1, 2];

export function isRatingValue(value: unknown): value is RatingValue {
  return value === -1 || value === 1 || value === 2;
}

export interface RatingChange {
  value: RatingValue | null;
  updatedAt: string | null;
}

const KIDS_MESSAGE = 'kids_no_rating';

function targetMatch(target: TitleRef) {
  return target.kind === 'video'
    ? eq(titleRatings.videoId, target.id)
    : eq(titleRatings.seriesId, target.id);
}

/**
 * Sets, changes or clears a profile's rating of a title (M44-S01). `null` clears. Idempotent, last write wins.
 * Kids profiles cannot rate (the database trigger says the same), the title must be visible to the profile, and an
 * episode is refused because a series is rated as a whole.
 */
export async function setRating(
  ctx: ViewerContext,
  actor: Actor,
  input: { profileId: string; target: TitleRef; value: RatingValue | null },
): Promise<RatingChange> {
  if (input.value !== null && !isRatingValue(input.value))
    throw new ValidationFailed({ value: ['Choose Not for me, Like or Love'] });
  return withAccount(ctx.db, actor, async (tx) => {
    const profile = await loadOwnedProfile(tx, actor, input.profileId);
    if (profile.isKids) throw new Forbidden(KIDS_MESSAGE);
    await spendAttempt(ctx, 'engage', actor.accountId);
    if (!isUuid(input.target.id)) throw new NotFound('Title not found');
    if (input.target.kind === 'video') {
      const kind = rowsOf<{ kind: string }>(
        await tx.execute(sql`SELECT kind FROM videos WHERE id = ${input.target.id}::uuid`),
      )[0]?.kind;
      if (kind === 'episode')
        throw new ValidationFailed({ target: ['Rate the series, not a single episode'] });
    }
    const visible = await fetchCards(tx, catalogContext(ctx), audienceOf(profile), [input.target]);
    if (visible.length === 0) throw new NotFound('Title not found');
    if (input.value === null) {
      await tx
        .delete(titleRatings)
        .where(and(eq(titleRatings.profileId, profile.id), targetMatch(input.target)));
      return { value: null, updatedAt: null };
    }
    const column =
      input.target.kind === 'video' ? { videoId: input.target.id } : { seriesId: input.target.id };
    const [existing] = await tx
      .select({ value: titleRatings.value, updatedAt: titleRatings.updatedAt })
      .from(titleRatings)
      .where(and(eq(titleRatings.profileId, profile.id), targetMatch(input.target)));
    if (existing && existing.value === input.value)
      return { value: input.value, updatedAt: existing.updatedAt.toISOString() };
    const now = new Date();
    if (existing) {
      await tx
        .update(titleRatings)
        .set({ value: input.value, updatedAt: now })
        .where(and(eq(titleRatings.profileId, profile.id), targetMatch(input.target)));
    } else {
      await tx
        .insert(titleRatings)
        .values({ profileId: profile.id, ...column, value: input.value, ratedAt: now, updatedAt: now })
        .onConflictDoNothing();
    }
    return { value: input.value, updatedAt: now.toISOString() };
  });
}

/** The profile's ratings for some titles, keyed by title id. Missing means not rated. */
export async function getRatings(
  ctx: ViewerContext,
  actor: Actor,
  input: { profileId: string; targets: readonly TitleRef[] },
): Promise<Map<string, RatingValue>> {
  return withAccount(ctx.db, actor, async (tx) => {
    const profile = await loadOwnedProfile(tx, actor, input.profileId);
    return ratingsFor(tx, profile.id, input.targets);
  });
}

type RatingTx = Parameters<Parameters<ViewerContext['db']['transaction']>[0]>[0];

/** Used inside a transaction that already verified the profile (cards, title page). */
export async function ratingsFor(
  tx: RatingTx,
  profileId: string,
  targets: readonly TitleRef[],
): Promise<Map<string, RatingValue>> {
  const videoIds = targets.filter((t) => t.kind === 'video').map((t) => t.id);
  const seriesIds = targets.filter((t) => t.kind === 'series').map((t) => t.id);
  const result = new Map<string, RatingValue>();
  if (videoIds.length === 0 && seriesIds.length === 0) return result;
  const rows = await tx
    .select({
      videoId: titleRatings.videoId,
      seriesId: titleRatings.seriesId,
      value: titleRatings.value,
    })
    .from(titleRatings)
    .where(
      and(
        eq(titleRatings.profileId, profileId),
        or(
          videoIds.length > 0 ? inArray(titleRatings.videoId, videoIds) : undefined,
          seriesIds.length > 0 ? inArray(titleRatings.seriesId, seriesIds) : undefined,
        ),
      ),
    );
  for (const row of rows) {
    const id = row.videoId ?? row.seriesId;
    if (id && isRatingValue(row.value)) result.set(id, row.value);
  }
  return result;
}

export interface MyRatingRow {
  profileId: string;
  kind: 'video' | 'series';
  id: string;
  value: RatingValue;
  ratedAt: string;
}

/** Every rating of the account, for the data export (M44-S25). */
export async function listMyRatings(ctx: ViewerContext, actor: Actor): Promise<MyRatingRow[]> {
  return withAccount(ctx.db, actor, async (tx) => {
    const rows = await tx.select().from(titleRatings);
    return rows.flatMap((row) => {
      const id = row.videoId ?? row.seriesId;
      if (!id || !isRatingValue(row.value)) return [];
      return [
        {
          profileId: row.profileId,
          kind: row.videoId ? ('video' as const) : ('series' as const),
          id,
          value: row.value,
          ratedAt: row.ratedAt.toISOString(),
        },
      ];
    });
  });
}
