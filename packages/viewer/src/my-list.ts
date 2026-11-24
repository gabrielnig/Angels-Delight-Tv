import { and, count, eq, sql } from 'drizzle-orm';
import { myList, profiles, withAccount } from '@ad/db';
import { Conflict, isUuid, NotFound, type Actor } from '@ad/shared';
import {
  clampLimit,
  decodeCursor,
  encodeCursor,
  fetchCards,
  liveSeriesSql,
  liveVideoSql,
  MAX_PAGE_SIZE,
  PAGE_SIZE,
  rowsOf,
  type Page,
  type TitleRef,
} from '@ad/catalog';
import { annotateCards, type TitleCardDto } from './annotate';
import { catalogContext, clockOf, rulesOf, type ViewerContext } from './context';
import { audienceOf, loadOwnedProfile } from './profiles';

type ViewerTx = Parameters<Parameters<ViewerContext['db']['transaction']>[0]>[0];

export const MY_LIST_FULL_MESSAGE = 'My List is full';

export interface MyListItem {
  card: TitleCardDto;
  addedAt: string;
}

export interface MyListChange {
  inList: boolean;
  addedAt: string | null;
}

function targetColumns(target: TitleRef) {
  return target.kind === 'video' ? { videoId: target.id } : { seriesId: target.id };
}

function targetMatch(target: TitleRef) {
  return target.kind === 'video' ? eq(myList.videoId, target.id) : eq(myList.seriesId, target.id);
}

/**
 * Saves a title for a profile. Idempotent. Episodes are not saved on their own, the series is (M10-S05).
 * `restoreAddedAt` puts an undone removal back at its old position (M10-S02).
 */
export async function addToMyList(
  ctx: ViewerContext,
  actor: Actor,
  input: { profileId: string; target: TitleRef; restoreAddedAt?: string },
): Promise<MyListChange> {
  const rules = rulesOf(ctx);
  const now = clockOf(ctx);
  return withAccount(ctx.db, actor, async (tx) => {
    const profile = await loadOwnedProfile(tx, actor, input.profileId);
    if (!isUuid(input.target.id)) throw new NotFound('Title not found');
    const visible = await fetchCards(tx, catalogContext(ctx), audienceOf(profile), [input.target]);
    if (visible.length === 0) throw new NotFound('Title not found');

    await tx.execute(
      sql`SELECT 1 FROM ${profiles} WHERE ${profiles.id} = ${profile.id}::uuid FOR UPDATE`,
    );
    const [existing] = await tx
      .select({ addedAt: myList.addedAt })
      .from(myList)
      .where(and(eq(myList.profileId, profile.id), targetMatch(input.target)));
    if (existing) return { inList: true, addedAt: existing.addedAt.toISOString() };

    const [{ total } = { total: 0 }] = await tx
      .select({ total: count() })
      .from(myList)
      .where(eq(myList.profileId, profile.id));
    if (total >= rules.maxMyListItems) throw new Conflict(MY_LIST_FULL_MESSAGE);

    const restored = input.restoreAddedAt ? new Date(input.restoreAddedAt) : null;
    const addedAt =
      restored && !Number.isNaN(restored.getTime()) && restored.getTime() <= now.getTime()
        ? restored
        : now;
    await tx
      .insert(myList)
      .values({ profileId: profile.id, ...targetColumns(input.target), addedAt })
      .onConflictDoNothing();
    return { inList: true, addedAt: addedAt.toISOString() };
  });
}

/** Removes a title. Succeeds when it was not there. Returns the old position marker for an undo. */
export async function removeFromMyList(
  ctx: ViewerContext,
  actor: Actor,
  input: { profileId: string; target: TitleRef },
): Promise<MyListChange> {
  return withAccount(ctx.db, actor, async (tx) => {
    const profile = await loadOwnedProfile(tx, actor, input.profileId);
    if (!isUuid(input.target.id)) return { inList: false, addedAt: null };
    const [removed] = await tx
      .delete(myList)
      .where(and(eq(myList.profileId, profile.id), targetMatch(input.target)))
      .returning({ addedAt: myList.addedAt });
    return { inList: false, addedAt: removed ? removed.addedAt.toISOString() : null };
  });
}

interface MyListCursor {
  k: string;
  i: string;
}

function isMyListCursor(value: unknown): value is MyListCursor {
  const candidate = value as MyListCursor;
  return (
    typeof candidate === 'object' &&
    candidate !== null &&
    typeof candidate.k === 'string' &&
    typeof candidate.i === 'string' &&
    isUuid(candidate.i)
  );
}

/**
 * The list, newest first. Titles that are not live for this profile (unpublished, not kids safe) are skipped in
 * the query itself, so pages stay full and the saved rows are kept for when the title returns (M10-S03).
 */
export async function listMyList(
  ctx: ViewerContext,
  actor: Actor,
  input: { profileId: string; limit?: number; cursor?: string },
): Promise<Page<MyListItem>> {
  return withAccount(ctx.db, actor, async (tx) =>
    loadMyList(tx, ctx, await loadOwnedProfile(tx, actor, input.profileId), input),
  );
}

/** The list page for a profile the caller has already verified, so Home can reuse its own transaction. */
export async function loadMyList(
  tx: ViewerTx,
  ctx: ViewerContext,
  profile: Pick<typeof profiles.$inferSelect, 'id' | 'isKids' | 'maxMaturityRank'>,
  input: { limit?: number; cursor?: string },
): Promise<Page<MyListItem>> {
  const limit = clampLimit(input.limit, PAGE_SIZE, MAX_PAGE_SIZE);
  const cursor = input.cursor === undefined ? null : decodeCursor(input.cursor, isMyListCursor);
  const now = clockOf(ctx);
  const audience = audienceOf(profile);
  const after = cursor
    ? sql` AND (ml.added_at, ml.id) < (${cursor.k}::timestamptz, ${cursor.i}::uuid)`
    : sql``;
  const result = await tx.execute(sql`
    SELECT ml.id, ml.added_at::text AS added_at_text, ml.video_id, ml.series_id
    FROM my_list ml
    LEFT JOIN videos v ON v.id = ml.video_id
    LEFT JOIN series s ON s.id = ml.series_id
    WHERE ml.profile_id = ${profile.id}::uuid
      AND ((ml.video_id IS NOT NULL AND v.kind = 'standalone' AND ${liveVideoSql('v', audience, now)})
        OR (ml.series_id IS NOT NULL AND ${liveSeriesSql('s', audience, now)}))${after}
    ORDER BY ml.added_at DESC, ml.id DESC
    LIMIT ${limit + 1}`);
  const rows = rowsOf<{
    id: string;
    added_at_text: string;
    video_id: string | null;
    series_id: string | null;
  }>(result);
  const pageRows = rows.slice(0, limit);
  const refs: TitleRef[] = pageRows.map((row) =>
    row.video_id ? { kind: 'video', id: row.video_id } : { kind: 'series', id: row.series_id! },
  );
  const cards = await annotateCards(
    tx,
    profile.id,
    await fetchCards(tx, catalogContext(ctx), audience, refs),
  );
  const byId = new Map(cards.map((card) => [card.id, card]));
  const items = pageRows.flatMap((row, index) => {
    const card = byId.get(refs[index]!.id);
    return card ? [{ card, addedAt: new Date(row.added_at_text).toISOString() }] : [];
  });
  const last = pageRows[pageRows.length - 1];
  return {
    items,
    nextCursor:
      rows.length > limit && last ? encodeCursor({ k: last.added_at_text, i: last.id }) : null,
  };
}

export interface MyListCounts {
  /** Saved titles this profile can see now. */
  visible: number;
  /** Saved titles kept but not shown, for example grown-up titles on a kids profile (M10-S03). */
  hidden: number;
}

export async function countMyList(
  ctx: ViewerContext,
  actor: Actor,
  input: { profileId: string },
): Promise<MyListCounts> {
  const now = clockOf(ctx);
  return withAccount(ctx.db, actor, async (tx) => {
    const profile = await loadOwnedProfile(tx, actor, input.profileId);
    const audience = audienceOf(profile);
    const result = await tx.execute(sql`
      SELECT count(*)::int AS saved,
        count(*) FILTER (WHERE (ml.video_id IS NOT NULL AND v.kind = 'standalone' AND ${liveVideoSql('v', audience, now)})
          OR (ml.series_id IS NOT NULL AND ${liveSeriesSql('s', audience, now)}))::int AS visible
      FROM my_list ml
      LEFT JOIN videos v ON v.id = ml.video_id
      LEFT JOIN series s ON s.id = ml.series_id
      WHERE ml.profile_id = ${profile.id}::uuid`);
    const row = rowsOf<{ saved: number; visible: number }>(result)[0] ?? { saved: 0, visible: 0 };
    return { visible: row.visible, hidden: row.saved - row.visible };
  });
}

/** Every saved title reference of a profile, for the "in my list" state of buttons across screens. Includes hidden titles. */
export async function listMyListRefs(
  ctx: ViewerContext,
  actor: Actor,
  input: { profileId: string },
): Promise<TitleRef[]> {
  return withAccount(ctx.db, actor, async (tx) => {
    const profile = await loadOwnedProfile(tx, actor, input.profileId);
    const saved = await tx
      .select({ videoId: myList.videoId, seriesId: myList.seriesId })
      .from(myList)
      .where(eq(myList.profileId, profile.id))
      .limit(rulesOf(ctx).maxMyListItems);
    return saved.map((row) =>
      row.videoId
        ? { kind: 'video' as const, id: row.videoId }
        : { kind: 'series' as const, id: row.seriesId! },
    );
  });
}
