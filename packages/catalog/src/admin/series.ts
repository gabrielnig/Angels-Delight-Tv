import { and, eq, sql } from 'drizzle-orm';
import { episodes, seasons, series, videos, withAccount } from '@ad/db';
import { writeAudit } from '../audit';
import {
  Forbidden,
  NotFound,
  ValidationFailed,
  isUuid,
  uuidv7,
  type Actor,
  isAdminRole,
  isStaffRole,
} from '@ad/shared';
import { rowsOf } from '../sql';
import type { Tx } from '../types';
import { publish, unpublish } from '../publishing';
import {
  OK,
  clean,
  fail,
  slugOf,
  type AdminContext,
  type AdminVideo,
  type CommandResult,
} from './types';
import { getAdminVideos } from './videos';
import { changeSlug } from './slugs';

export interface AdminSeries {
  id: string;
  title: string;
  description: string;
  posterId: string | null;
  published: boolean;
  episodeCount: number;
  /** 0 (G) to 4 (18), null until rated. */
  maturityRank: number | null;
}

export interface AdminSeriesDetail {
  series: AdminSeries;
  episodes: AdminVideo[];
  available: AdminVideo[];
}

function assertStaff(actor: Actor): void {
  if (!isStaffRole(actor.role)) throw new Forbidden('Editors only');
}

const NOT_FOUND = 'Series not found.';

interface Row {
  id: string;
  title: string;
  description: string | null;
  poster_asset_id: string | null;
  publish_state: string;
  maturity_rank: number | null;
  episode_count: string | number;
}

const toSeries = (row: Row): AdminSeries => ({
  id: row.id,
  title: row.title,
  description: row.description ?? '',
  posterId: row.poster_asset_id,
  published: row.publish_state === 'published',
  episodeCount: Number(row.episode_count),
  maturityRank: row.maturity_rank ?? null,
});

const SELECT = sql`
  SELECT s.id, s.title, s.description, s.poster_asset_id, s.publish_state, s.maturity_rank,
    (SELECT count(*) FROM seasons sn JOIN episodes e ON e.season_id = sn.id JOIN videos v ON v.id = e.video_id
      WHERE sn.series_id = s.id AND v.deleted_at IS NULL) AS episode_count
  FROM series s`;

export async function listAdminSeries(ctx: AdminContext, actor: Actor): Promise<AdminSeries[]> {
  assertStaff(actor);
  return withAccount(ctx.db, actor, async (tx) =>
    rowsOf<Row>(
      await tx.execute(sql`${SELECT} WHERE s.deleted_at IS NULL ORDER BY s.created_at DESC, s.id`),
    ).map(toSeries),
  );
}

export async function getAdminSeriesDetail(
  ctx: AdminContext,
  actor: Actor,
  id: string,
): Promise<AdminSeriesDetail> {
  assertStaff(actor);
  if (!isUuid(id)) throw new NotFound(NOT_FOUND);
  const { row, episodeIds, availableIds } = await withAccount(ctx.db, actor, async (tx) => {
    const row = rowsOf<Row>(
      await tx.execute(sql`${SELECT} WHERE s.id = ${id}::uuid AND s.deleted_at IS NULL`),
    )[0];
    if (!row) throw new NotFound(NOT_FOUND);
    const episodeIds = rowsOf<{ video_id: string }>(
      await tx.execute(sql`
        SELECT e.video_id FROM episodes e JOIN seasons sn ON sn.id = e.season_id JOIN videos v ON v.id = e.video_id
        WHERE sn.series_id = ${id}::uuid AND v.deleted_at IS NULL ORDER BY sn.number, e.number`),
    ).map((r) => r.video_id);
    const availableIds = rowsOf<{ id: string }>(
      await tx.execute(sql`
        SELECT v.id FROM videos v WHERE v.deleted_at IS NULL AND v.kind = 'standalone'
        ORDER BY v.updated_at DESC LIMIT 200`),
    ).map((r) => r.id);
    return { row, episodeIds, availableIds };
  });
  const all = await getAdminVideos(ctx, actor, [...episodeIds, ...availableIds]);
  const byId = new Map(all.map((v) => [v.id, v]));
  return {
    series: toSeries(row),
    episodes: episodeIds.map((e) => byId.get(e)).filter((v): v is AdminVideo => Boolean(v)),
    available: availableIds.map((e) => byId.get(e)).filter((v): v is AdminVideo => Boolean(v)),
  };
}

async function audit(tx: Tx, actor: Actor, action: string, id: string, summary: string) {
  await writeAudit(tx, {
    action,
    outcome: 'success',
    actorAccountId: actor.accountId,
    actorRole: actor.role,
    targetType: 'series',
    targetId: id,
    summary,
  });
}

async function freeSlug(tx: Tx, title: string): Promise<string> {
  const base = slugOf(title, `series-${uuidv7().slice(-8)}`);
  for (let n = 1; n < 50; n++) {
    const candidate = n === 1 ? base : `${base}-${n}`;
    const [taken] = await tx
      .select({ id: series.id })
      .from(series)
      .where(and(eq(series.slug, candidate), sql`${series.deletedAt} IS NULL`));
    if (!taken) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}

export async function createAdminSeries(
  ctx: AdminContext,
  actor: Actor,
  input: { title: string; description: string },
): Promise<CommandResult> {
  assertStaff(actor);
  const title = clean(input.title);
  if (!title) return fail('Give the series a title.');
  if (title.length > 80) return fail('Use 80 characters or fewer.');
  return withAccount(ctx.db, actor, async (tx) => {
    const [row] = await tx
      .insert(series)
      .values({
        title,
        slug: await freeSlug(tx, title),
        description: input.description.trim().slice(0, 500) || null,
        createdBy: actor.accountId,
      })
      .returning({ id: series.id });
    await audit(tx, actor, 'series.create', row!.id, `Created series ${title}`);
    return OK;
  });
}

export interface SeriesEdit {
  title?: string;
  slug?: string;
  description?: string;
  published?: boolean;
  /** 0 (G) to 4 (18). The trigger keeps kids_safe equal to rank 0. */
  maturityRank?: number;
  /** With maturityRank: give every episode the same rating. The editor confirms this in the UI. */
  applyToEpisodes?: boolean;
}

export async function updateAdminSeries(
  ctx: AdminContext,
  actor: Actor,
  id: string,
  edit: SeriesEdit,
): Promise<CommandResult> {
  assertStaff(actor);
  if (!isUuid(id)) return fail(NOT_FOUND);
  const set: Partial<typeof series.$inferInsert> = {};
  if (edit.title !== undefined) {
    const title = clean(edit.title);
    if (!title) return fail('Give the series a title.');
    set.title = title.slice(0, 80);
  }
  if (edit.description !== undefined)
    set.description = edit.description.trim().slice(0, 500) || null;
  if (edit.maturityRank !== undefined) {
    if (!Number.isInteger(edit.maturityRank) || edit.maturityRank < 0 || edit.maturityRank > 4)
      return fail('Choose one of the five ratings.');
    set.maturityRank = edit.maturityRank;
  }

  let slugText: string | null = null;
  const found = await withAccount(ctx.db, actor, async (tx) => {
    const [current] = await tx
      .select()
      .from(series)
      .where(and(eq(series.id, id), sql`${series.deletedAt} IS NULL`));
    if (!current) return null;
    if (edit.slug !== undefined) {
      const problem = await changeSlug(tx, 'series', id, current.slug, edit.slug);
      if (problem) {
        slugText = problem;
        return null;
      }
      await audit(
        tx,
        actor,
        'series.update',
        id,
        `Changed the address of ${current.title} to ${edit.slug}`,
      );
    }
    if (Object.keys(set).length) {
      await tx.update(series).set(set).where(eq(series.id, id));
      await audit(tx, actor, 'series.update', id, `Edited series ${set.title ?? current.title}`);
    }
    if (set.maturityRank !== undefined && set.maturityRank !== current.maturityRank) {
      await audit(
        tx,
        actor,
        'series.maturity',
        id,
        `Maturity rating of ${current.title} changed from ${current.maturityRank ?? 'none'} to ${set.maturityRank}`,
      );
    }
    if (set.maturityRank !== undefined && edit.applyToEpisodes) {
      await tx.execute(sql`
        UPDATE videos SET maturity_rank = ${set.maturityRank}
        WHERE deleted_at IS NULL AND id IN (
          SELECT e.video_id FROM episodes e JOIN seasons sn ON sn.id = e.season_id WHERE sn.series_id = ${id}::uuid)`);
      await audit(tx, actor, 'series.maturity', id, `Gave every episode of ${current.title} rating ${set.maturityRank}`);
    }
    const publishedEpisodes = Number(
      rowsOf<{ count: string }>(
        await tx.execute(sql`
          SELECT count(*) AS count FROM episodes e JOIN seasons sn ON sn.id = e.season_id JOIN videos v ON v.id = e.video_id
          WHERE sn.series_id = ${id}::uuid AND v.deleted_at IS NULL AND v.publish_state = 'published'`),
      )[0]!.count,
    );
    return { current, publishedEpisodes };
  });
  if (slugText) return fail(slugText);
  if (!found) return fail(NOT_FOUND);
  if (edit.published === undefined) return OK;
  if (edit.published === (found.current.publishState === 'published')) return OK;

  if (edit.published) {
    if (found.publishedEpisodes === 0)
      return fail('Publish at least one episode before publishing the series.');
    try {
      await publish(ctx, actor, 'series', id);
    } catch (error) {
      if (error instanceof ValidationFailed) {
        const missing = error.fields.checklist ?? [];
        return fail(`Not ready: ${missing.join(', ')}.`);
      }
      throw error;
    }
  } else if (
    found.current.publishState === 'published' ||
    found.current.publishState === 'scheduled'
  ) {
    await unpublish(ctx, actor, 'series', id);
  }
  return OK;
}

export async function deleteAdminSeries(
  ctx: AdminContext,
  actor: Actor,
  id: string,
): Promise<CommandResult> {
  if (!isStaffRole(actor.role) || !isAdminRole(actor.role)) throw new Forbidden('Admins only');
  if (!isUuid(id)) return fail(NOT_FOUND);
  return withAccount(ctx.db, actor, async (tx) => {
    const [current] = await tx
      .select()
      .from(series)
      .where(and(eq(series.id, id), sql`${series.deletedAt} IS NULL`))
      .for('update');
    if (!current) return fail(NOT_FOUND);
    const freed = rowsOf<{ video_id: string }>(
      await tx.execute(sql`
        SELECT e.video_id FROM episodes e JOIN seasons sn ON sn.id = e.season_id WHERE sn.series_id = ${id}::uuid`),
    ).map((r) => r.video_id);
    await tx.delete(seasons).where(eq(seasons.seriesId, id)); // episodes go with their seasons
    if (freed.length)
      await tx
        .update(videos)
        .set({ kind: 'standalone' })
        .where(
          sql`${videos.id} IN (${sql.join(
            freed.map((f) => sql`${f}::uuid`),
            sql`, `,
          )})`,
        );
    await tx
      .update(series)
      .set({ deletedAt: ctx.now?.() ?? new Date(), publishState: 'unpublished', publishAt: null })
      .where(eq(series.id, id));
    await audit(tx, actor, 'series.delete', id, `Deleted series ${current.title}`);
    return OK;
  });
}

/** Puts a video into a season of a series, or takes it out when `seriesId` is null. */
export async function setAdminEpisode(
  ctx: AdminContext,
  actor: Actor,
  videoId: string,
  seriesId: string | null,
  season: number | null,
  episode: number | null,
): Promise<CommandResult> {
  assertStaff(actor);
  if (!isUuid(videoId)) return fail('Video not found.');
  if (seriesId !== null && !isUuid(seriesId)) return fail(NOT_FOUND);
  if (
    seriesId &&
    ((season ?? 1) < 1 || (episode !== null && episode < 1) || !Number.isInteger(season ?? 1))
  )
    return fail('Use whole numbers from 1.');
  return withAccount(ctx.db, actor, async (tx) => {
    const [video] = await tx
      .select({ id: videos.id, title: videos.title })
      .from(videos)
      .where(and(eq(videos.id, videoId), sql`${videos.deletedAt} IS NULL`))
      .for('update');
    if (!video) return fail('Video not found.');
    let target: { id: string; title: string } | undefined;
    if (seriesId) {
      [target] = await tx
        .select({ id: series.id, title: series.title })
        .from(series)
        .where(and(eq(series.id, seriesId), sql`${series.deletedAt} IS NULL`));
      if (!target) return fail(NOT_FOUND);
    }
    if (!seriesId) {
      await tx.delete(episodes).where(eq(episodes.videoId, videoId));
      await tx.update(videos).set({ kind: 'standalone' }).where(eq(videos.id, videoId));
      await audit(
        tx,
        actor,
        'series.episode_remove',
        videoId,
        `Took ${video.title} out of its series`,
      );
      return OK;
    }
    const seasonNumber = season ?? 1;
    let [seasonRow] = await tx
      .select({ id: seasons.id })
      .from(seasons)
      .where(and(eq(seasons.seriesId, seriesId), eq(seasons.number, seasonNumber)));
    const number =
      episode ??
      (seasonRow
        ? Number(
            rowsOf<{ next: number }>(
              await tx.execute(
                sql`SELECT coalesce(max(number), 0) + 1 AS next FROM episodes WHERE season_id = ${seasonRow.id}::uuid AND video_id <> ${videoId}::uuid`,
              ),
            )[0]!.next,
          )
        : 1);
    if (seasonRow) {
      const [clash] = await tx
        .select({ id: episodes.id })
        .from(episodes)
        .where(
          and(
            eq(episodes.seasonId, seasonRow.id),
            eq(episodes.number, number),
            sql`${episodes.videoId} <> ${videoId}::uuid`,
          ),
        );
      if (clash) return fail(`Season ${seasonNumber} already has an episode ${number}.`);
    }
    await tx.delete(episodes).where(eq(episodes.videoId, videoId));
    if (!seasonRow) {
      [seasonRow] = await tx
        .insert(seasons)
        .values({ seriesId, number: seasonNumber })
        .returning({ id: seasons.id });
    }
    await tx.update(videos).set({ kind: 'episode' }).where(eq(videos.id, videoId));
    await tx.insert(episodes).values({ seasonId: seasonRow!.id, videoId, number });
    await audit(
      tx,
      actor,
      'series.episode_set',
      videoId,
      `Put ${video.title} in ${target!.title}, season ${seasonNumber}, episode ${number}`,
    );
    return OK;
  });
}
