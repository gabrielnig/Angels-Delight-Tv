import { and, eq, sql } from 'drizzle-orm';
import { assets, categories, videoCategories, videos, withAccount } from '@ad/db';
import { writeAudit } from '@ad/audit';
import { Forbidden, NotFound, ValidationFailed, isUuid, type Actor } from '@ad/shared';
import { rowsOf } from '../sql';
import type { Tx } from '../types';
import { publish, unpublish } from '../publishing';
import {
  OK,
  fail,
  isoOf,
  type AdminContext,
  type AdminVideo,
  type CommandResult,
  type Suitability,
} from './types';

function assertStaff(actor: Actor): void {
  if (actor.role !== 'editor' && actor.role !== 'admin') throw new Forbidden('Editors only');
}
function assertAdmin(actor: Actor): void {
  if (actor.role !== 'admin') throw new Forbidden('Admins only');
}

interface Row {
  id: string;
  title: string;
  description: string | null;
  tags: string[];
  status: AdminVideo['status'];
  publish_state: AdminVideo['publishState'];
  publish_at: Date | string | null;
  published_at: Date | string | null;
  duration_ms: number | null;
  original_bytes: string | number | null;
  poster_asset_id: string | null;
  poster_alt: string | null;
  poster_focus: { x: number; y: number; zoom: number } | null;
  suitability: Suitability | null;
  kids_safe: boolean;
  created_by: string | null;
  created_at: Date | string;
  updated_at: Date | string;
  deleted_at: Date | string | null;
  failure_code: string | null;
  failure_message: string | null;
  caption_override_reason: string | null;
  category_ids: string[];
  series_id: string | null;
  season_number: number | null;
  episode_number: number | null;
  cap_status: 'draft' | 'in_review' | 'approved' | 'rejected' | 'superseded' | null;
  cap_cues: number | null;
  cap_generating: boolean;
  cap_failed: boolean;
  job_progress: number | null;
  job_stage: string | null;
  views: string | number;
}

const iso = (value: Date | string) => isoOf(value)!;

function toVideo(row: Row): AdminVideo {
  const captionState: AdminVideo['captionState'] = row.cap_generating
    ? 'generating'
    : row.cap_status === 'approved'
      ? 'approved'
      : row.cap_status
        ? 'needs_review'
        : row.cap_failed
          ? 'failed'
          : 'none';
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? '',
    tags: row.tags ?? [],
    categoryIds: row.category_ids ?? [],
    status: row.status,
    publishState: row.publish_state,
    publishAt: isoOf(row.publish_at),
    publishedAt: isoOf(row.published_at),
    durationSeconds: Math.round((row.duration_ms ?? 0) / 1000),
    sizeBytes: Number(row.original_bytes ?? 0),
    captionState,
    captionCueCount: row.cap_cues ?? 0,
    posterId: row.poster_asset_id,
    posterAlt: row.poster_alt,
    posterFocus: row.poster_focus,
    // Older rows have no suitability: derive it from the kids flag.
    suitability: row.suitability ?? (row.kids_safe ? 'kids' : null),
    seriesId: row.series_id,
    seasonNumber: row.season_number,
    episodeNumber: row.episode_number,
    views: Number(row.views),
    createdBy: row.created_by,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
    deletedAt: isoOf(row.deleted_at),
    failure:
      row.status === 'failed'
        ? {
            stage: row.job_stage ?? 'processing',
            reason: row.failure_message ?? 'Processing failed.',
          }
        : null,
    progress: row.status === 'ready' ? 100 : (row.job_progress ?? 0),
    captionOverrideReason: row.caption_override_reason,
  };
}

const SELECT = sql`
  SELECT v.id, v.title, v.description, v.tags, v.status, v.publish_state, v.publish_at, v.published_at,
    v.duration_ms, v.original_bytes, v.poster_asset_id, pa.alt_text AS poster_alt, v.poster_focus,
    v.suitability, v.kids_safe, v.created_by, v.created_at, v.updated_at, v.deleted_at,
    v.failure_code, v.failure_message, v.caption_override_reason,
    coalesce((SELECT array_agg(vc.category_id::text ORDER BY c.position)
      FROM video_categories vc JOIN categories c ON c.id = vc.category_id WHERE vc.video_id = v.id), '{}') AS category_ids,
    ep.series_id, ep.season_number, ep.episode_number,
    cap.status AS cap_status, cap.cue_count AS cap_cues,
    EXISTS (SELECT 1 FROM jobs j WHERE j.video_id = v.id AND j.queue = 'caption.generate'
      AND j.status IN ('queued', 'running')) AS cap_generating,
    EXISTS (SELECT 1 FROM jobs j WHERE j.video_id = v.id AND j.queue = 'caption.generate'
      AND j.status IN ('failed', 'failed_permanent')
      AND NOT EXISTS (SELECT 1 FROM jobs k WHERE k.video_id = v.id AND k.queue = 'caption.generate' AND k.created_at > j.created_at)) AS cap_failed,
    job.progress AS job_progress, job.stage AS job_stage,
    coalesce((SELECT sum(s.views) FROM video_daily_stats s WHERE s.video_id = v.id), 0) AS views
  FROM videos v
  LEFT JOIN assets pa ON pa.id = v.poster_asset_id
  LEFT JOIN LATERAL (
    SELECT se.series_id, se.number AS season_number, e.number AS episode_number
    FROM episodes e JOIN seasons se ON se.id = e.season_id WHERE e.video_id = v.id) ep ON true
  LEFT JOIN LATERAL (
    SELECT c.status, c.cue_count FROM caption_tracks ct JOIN captions c ON c.track_id = ct.id
    WHERE ct.video_id = v.id AND ct.language = 'en' ORDER BY c.revision DESC LIMIT 1) cap ON true
  LEFT JOIN LATERAL (
    SELECT j.progress, j.stage FROM jobs j WHERE j.video_id = v.id
      AND j.queue IN ('video.probe', 'video.encode', 'video.thumbnails') ORDER BY j.created_at DESC LIMIT 1) job ON true`;

export const ADMIN_VIDEO_LIMIT = 5000;

/** Every live video, newest change first. Admin catalogs are small, so filtering and paging happen in the caller. */
export async function listAdminVideos(
  ctx: AdminContext,
  actor: Actor,
  options: { trashed?: boolean } = {},
): Promise<AdminVideo[]> {
  assertStaff(actor);
  if (options.trashed) assertStaff(actor);
  return withAccount(ctx.db, actor, async (tx) => {
    const result = await tx.execute(
      sql`${SELECT} WHERE ${
        options.trashed
          ? sql`v.deleted_at IS NOT NULL AND NOT EXISTS (SELECT 1 FROM jobs pj WHERE pj.video_id = v.id AND pj.queue = 'video.purge' AND pj.status IN ('queued', 'running'))`
          : sql`v.deleted_at IS NULL`
      }
        ORDER BY v.updated_at DESC, v.id LIMIT ${ADMIN_VIDEO_LIMIT}`,
    );
    return rowsOf<Row>(result).map(toVideo);
  });
}

export async function getAdminVideo(
  ctx: AdminContext,
  actor: Actor,
  id: string,
): Promise<AdminVideo> {
  assertStaff(actor);
  if (!isUuid(id)) throw new NotFound('Video not found');
  return withAccount(ctx.db, actor, async (tx) => {
    const result = await tx.execute(
      sql`${SELECT} WHERE v.id = ${id}::uuid AND v.deleted_at IS NULL`,
    );
    const row = rowsOf<Row>(result)[0];
    if (!row) throw new NotFound('Video not found');
    return toVideo(row);
  });
}

export async function getAdminVideos(
  ctx: AdminContext,
  actor: Actor,
  ids: readonly string[],
): Promise<AdminVideo[]> {
  assertStaff(actor);
  const valid = ids.filter(isUuid);
  if (!valid.length) return [];
  return withAccount(ctx.db, actor, async (tx) => {
    const list = sql.join(
      valid.map((id) => sql`${id}::uuid`),
      sql`, `,
    );
    const result = await tx.execute(sql`${SELECT} WHERE v.id IN (${list})`);
    return rowsOf<Row>(result).map(toVideo);
  });
}

export interface VideoEdit {
  title?: string;
  description?: string;
  tags?: string[];
  categoryIds?: string[];
  suitability?: Suitability | null;
}

/** Edits the details an editor owns. The caller has validated the text, and the database constraints are the backstop. */
export async function updateAdminVideo(
  ctx: AdminContext,
  actor: Actor,
  id: string,
  edit: VideoEdit,
): Promise<AdminVideo> {
  assertStaff(actor);
  if (!isUuid(id)) throw new NotFound('Video not found');
  await withAccount(ctx.db, actor, async (tx) => {
    const [current] = await tx
      .select()
      .from(videos)
      .where(and(eq(videos.id, id), sql`${videos.deletedAt} IS NULL`))
      .for('update');
    if (!current) throw new NotFound('Video not found');
    const set: Partial<typeof videos.$inferInsert> = {};
    if (edit.title !== undefined) set.title = edit.title;
    if (edit.description !== undefined) set.description = edit.description || null;
    if (edit.tags !== undefined) set.tags = edit.tags;
    if (edit.suitability !== undefined) {
      set.suitability = edit.suitability;
      set.kidsSafe = edit.suitability === 'kids' || edit.suitability === 'everyone';
    }
    if (edit.categoryIds !== undefined) {
      const found = edit.categoryIds.length
        ? await tx
            .select({ id: categories.id })
            .from(categories)
            .where(
              sql`${categories.id} IN (${sql.join(
                edit.categoryIds.map((c) => sql`${c}::uuid`),
                sql`, `,
              )})`,
            )
        : [];
      if (found.length !== new Set(edit.categoryIds).size)
        throw new ValidationFailed({ categoryIds: ['Pick categories from the list.'] });
      await tx.delete(videoCategories).where(eq(videoCategories.videoId, id));
      if (edit.categoryIds.length)
        await tx
          .insert(videoCategories)
          .values(
            [...new Set(edit.categoryIds)].map((categoryId) => ({ videoId: id, categoryId })),
          );
    }
    if (Object.keys(set).length) await tx.update(videos).set(set).where(eq(videos.id, id));
    else await tx.update(videos).set({ updatedAt: new Date() }).where(eq(videos.id, id));
    await writeAudit(tx, {
      action: 'video.update',
      outcome: 'success',
      actorAccountId: actor.accountId,
      actorRole: actor.role,
      targetType: 'video',
      targetId: id,
      summary: `Edited ${set.title ?? current.title}`,
      extra: { fields: Object.keys(edit) },
    });
  });
  return getAdminVideo(ctx, actor, id);
}

export interface PosterInput {
  posterId: string;
  alt: string;
  focus: { x: number; y: number };
  zoom: number;
}

export async function setAdminPoster(
  ctx: AdminContext,
  actor: Actor,
  id: string,
  input: PosterInput,
): Promise<CommandResult> {
  assertStaff(actor);
  if (!isUuid(id)) throw new NotFound('Video not found');
  return withAccount(ctx.db, actor, async (tx) => {
    const [video] = await tx
      .select({ id: videos.id, title: videos.title })
      .from(videos)
      .where(and(eq(videos.id, id), sql`${videos.deletedAt} IS NULL`))
      .for('update');
    if (!video) throw new NotFound('Video not found');
    if (!isUuid(input.posterId)) return fail('Choose one of the poster images.');
    const [asset] = await tx
      .select({ id: assets.id, status: assets.status, purpose: assets.purpose })
      .from(assets)
      .where(eq(assets.id, input.posterId));
    if (!asset || asset.status !== 'ready' || !['thumbnail', 'hero'].includes(asset.purpose))
      return fail('Choose one of the poster images.');
    await tx
      .update(assets)
      .set({ altText: input.alt.trim().slice(0, 200) })
      .where(eq(assets.id, asset.id));
    await tx
      .update(videos)
      .set({ posterAssetId: asset.id, posterFocus: { ...input.focus, zoom: input.zoom } })
      .where(eq(videos.id, id));
    await writeAudit(tx, {
      action: 'video.poster',
      outcome: 'success',
      actorAccountId: actor.accountId,
      actorRole: actor.role,
      targetType: 'video',
      targetId: id,
      summary: `Changed the poster for ${video.title}`,
    });
    return OK;
  });
}

/** Moves videos to Trash. Admins only (SECURITY.md section 5). Viewers stop seeing them at once. */
export async function trashVideos(
  ctx: AdminContext,
  actor: Actor,
  ids: readonly string[],
): Promise<{ succeeded: string[]; failed: Array<{ id: string; reason: string }> }> {
  assertAdmin(actor);
  const result = { succeeded: [] as string[], failed: [] as Array<{ id: string; reason: string }> };
  for (const id of ids) {
    if (!isUuid(id)) {
      result.failed.push({ id, reason: 'That video no longer exists.' });
      continue;
    }
    const moved = await withAccount(ctx.db, actor, async (tx) => {
      const [row] = await tx
        .update(videos)
        .set({ deletedAt: ctx.now?.() ?? new Date() })
        .where(and(eq(videos.id, id), sql`${videos.deletedAt} IS NULL`))
        .returning({ title: videos.title });
      if (!row) return false;
      await writeAudit(tx, {
        action: 'video.trash',
        outcome: 'success',
        actorAccountId: actor.accountId,
        actorRole: actor.role,
        targetType: 'video',
        targetId: id,
        summary: `Moved ${row.title} to Trash`,
      });
      return true;
    });
    if (moved) result.succeeded.push(id);
    else result.failed.push({ id, reason: 'That video no longer exists.' });
  }
  return result;
}

export async function restoreAdminVideo(
  ctx: AdminContext,
  actor: Actor,
  id: string,
): Promise<CommandResult> {
  assertStaff(actor);
  if (!isUuid(id)) return fail('That video is not in Trash.');
  try {
    return await withAccount(ctx.db, actor, async (tx) => {
      const [row] = await tx
        .update(videos)
        .set({ deletedAt: null })
        .where(and(eq(videos.id, id), sql`${videos.deletedAt} IS NOT NULL`))
        .returning({ title: videos.title });
      if (!row) return fail('That video is not in Trash.');
      await writeAudit(tx, {
        action: 'video.restore',
        outcome: 'success',
        actorAccountId: actor.accountId,
        actorRole: actor.role,
        targetType: 'video',
        targetId: id,
        summary: `Restored ${row.title} from Trash`,
      });
      return OK;
    });
  } catch (error) {
    // The web address was taken by a newer video while this one sat in Trash.
    if (JSON.stringify(error, Object.getOwnPropertyNames(error)).includes('videos_slug_live_uniq'))
      return fail('Another video now uses this web address. Rename that one first.');
    throw error;
  }
}

export type BulkAction =
  | { type: 'publish' }
  | { type: 'unpublish' }
  | { type: 'trash' }
  | { type: 'category'; categoryId: string }
  | { type: 'suitability'; value: Suitability };

/**
 * Sets suitability on every selected video in one transaction (M35-S04 AC3). If any id cannot be updated
 * nothing changes and the failed ids are reported.
 */
async function setSuitabilityAll(
  ctx: AdminContext,
  actor: Actor,
  ids: readonly string[],
  value: Suitability,
): Promise<{ succeeded: string[]; failed: Array<{ id: string; reason: string }> }> {
  const unique = [...new Set(ids)];
  const gone = unique.filter((id) => !isUuid(id));
  if (gone.length)
    return {
      succeeded: [],
      failed: gone.map((id) => ({ id, reason: 'That video no longer exists.' })),
    };
  return withAccount(ctx.db, actor, async (tx) => {
    const rows = unique.length
      ? await tx
          .select({ id: videos.id, title: videos.title })
          .from(videos)
          .where(
            and(
              sql`${videos.id} IN (${sql.join(
                unique.map((id) => sql`${id}::uuid`),
                sql`, `,
              )})`,
              sql`${videos.deletedAt} IS NULL`,
            ),
          )
          .for('update')
      : [];
    const found = new Set(rows.map((row) => row.id));
    const missing = unique.filter((id) => !found.has(id));
    if (missing.length)
      return {
        succeeded: [],
        failed: missing.map((id) => ({ id, reason: 'That video no longer exists.' })),
      };
    for (const row of rows) {
      await tx
        .update(videos)
        .set({ suitability: value, kidsSafe: value === 'kids' || value === 'everyone' })
        .where(eq(videos.id, row.id));
      await writeAudit(tx, {
        action: 'video.update',
        outcome: 'success',
        actorAccountId: actor.accountId,
        actorRole: actor.role,
        targetType: 'video',
        targetId: row.id,
        summary: `Set suitability of ${row.title} to ${value}`,
        extra: { fields: ['suitability'], bulk: true },
      });
    }
    return { succeeded: unique, failed: [] };
  });
}

/** Each id succeeds or fails alone so one bad video never blocks the rest. */
export async function bulkAdminVideos(
  ctx: AdminContext,
  actor: Actor,
  ids: readonly string[],
  action: BulkAction,
): Promise<{ succeeded: string[]; failed: Array<{ id: string; reason: string }> }> {
  assertStaff(actor);
  if (action.type === 'trash') {
    if (actor.role !== 'admin')
      return {
        succeeded: [],
        failed: ids.map((id) => ({ id, reason: 'Only an admin can move videos to Trash.' })),
      };
    return trashVideos(ctx, actor, ids);
  }
  if (action.type === 'suitability') return setSuitabilityAll(ctx, actor, ids, action.value);
  const result = { succeeded: [] as string[], failed: [] as Array<{ id: string; reason: string }> };
  for (const id of ids) {
    try {
      if (action.type === 'publish') await publish(ctx, actor, 'video', id);
      else if (action.type === 'unpublish') await unpublish(ctx, actor, 'video', id);
      else {
        const done = await addToCategory(ctx, actor, id, action.categoryId);
        if (!done.ok) {
          result.failed.push({ id, reason: done.error });
          continue;
        }
      }
      result.succeeded.push(id);
    } catch (error) {
      result.failed.push({ id, reason: reasonOf(error) });
    }
  }
  return result;
}

function reasonOf(error: unknown): string {
  if (error instanceof ValidationFailed) {
    const missing = (error.fields as Record<string, string[]> | undefined)?.checklist;
    if (missing?.length) return `Not ready: ${missing[0]} needs attention first.`;
  }
  if (error instanceof NotFound) return 'That video no longer exists.';
  if (error instanceof Forbidden) return 'You do not have permission for this.';
  return error instanceof Error ? error.message : 'Something went wrong.';
}

export async function addToCategory(
  ctx: AdminContext,
  actor: Actor,
  videoId: string,
  categoryId: string,
): Promise<CommandResult> {
  assertStaff(actor);
  if (!isUuid(videoId) || !isUuid(categoryId)) return fail('That video no longer exists.');
  return withAccount(ctx.db, actor, async (tx: Tx) => {
    const [video] = await tx
      .select({ id: videos.id })
      .from(videos)
      .where(and(eq(videos.id, videoId), sql`${videos.deletedAt} IS NULL`));
    if (!video) return fail('That video no longer exists.');
    const [category] = await tx
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.id, categoryId));
    if (!category) return fail('Pick categories from the list.');
    await tx.insert(videoCategories).values({ videoId, categoryId }).onConflictDoNothing();
    await tx.update(videos).set({ updatedAt: new Date() }).where(eq(videos.id, videoId));
    return OK;
  });
}

/** Queues one job. `JobProducer.enqueue` fits this shape, and tests pass a recorder. */
export type Enqueue = (
  queue: 'video.probe' | 'video.encode' | 'video.purge',
  payload: { videoId: string },
  options?: { createdBy?: string },
) => Promise<unknown>;

/** Admin Retry: restart from the last good stage (M14-S06). Probe first when the file was never read. */
export async function retryAdminVideo(
  ctx: AdminContext,
  actor: Actor,
  id: string,
  enqueue: Enqueue,
): Promise<CommandResult> {
  assertStaff(actor);
  if (!isUuid(id)) throw new NotFound('Video not found');
  const queue = await withAccount(ctx.db, actor, async (tx) => {
    const [video] = await tx.select().from(videos).where(eq(videos.id, id)).for('update');
    if (!video) throw new NotFound('Video not found');
    if (video.status !== 'failed') return fail('Only failed videos can be retried.');
    if (!video.originalKey) return fail('The source file was removed. Replace the file instead.');
    await tx
      .update(videos)
      .set({ status: 'uploaded', failureCode: null, failureMessage: null })
      .where(eq(videos.id, id));
    await writeAudit(tx, {
      action: 'video.retry',
      outcome: 'success',
      actorAccountId: actor.accountId,
      actorRole: actor.role,
      targetType: 'video',
      targetId: id,
      summary: `Retried processing for ${video.title}`,
    });
    return video.durationMs ? ('video.encode' as const) : ('video.probe' as const);
  });
  if (typeof queue !== 'string') return queue;
  await enqueue(queue, { videoId: id }, { createdBy: actor.accountId });
  return OK;
}

/** Delete forever (admin only): records the decision, then queues the job that removes files and the row. */
export async function requestPurgeAdminVideo(
  ctx: AdminContext,
  actor: Actor,
  id: string,
  enqueue: Enqueue,
): Promise<CommandResult> {
  assertAdmin(actor);
  if (!isUuid(id)) return fail('That video is not in Trash.');
  const found = await withAccount(ctx.db, actor, async (tx) => {
    const [video] = await tx
      .select({ title: videos.title })
      .from(videos)
      .where(and(eq(videos.id, id), sql`${videos.deletedAt} IS NOT NULL`));
    if (!video) return false;
    await writeAudit(tx, {
      action: 'video.purge',
      outcome: 'success',
      actorAccountId: actor.accountId,
      actorRole: actor.role,
      targetType: 'video',
      targetId: id,
      summary: `Deleted ${video.title} forever`,
    });
    return true;
  });
  if (!found) return fail('That video is not in Trash.');
  await enqueue('video.purge', { videoId: id }, { createdBy: actor.accountId });
  return OK;
}

/** Counts for the navigation badges. One cheap query, because it runs on every admin page. */
export async function adminNavCounts(
  ctx: AdminContext,
  actor: Actor,
): Promise<{ encoding: number; captions: number }> {
  assertStaff(actor);
  return withAccount(ctx.db, actor, async (tx) => {
    const result = await tx.execute(sql`
      SELECT
        (SELECT count(*) FROM videos v WHERE v.deleted_at IS NULL AND v.status IN ('uploaded', 'validating', 'encoding')) AS encoding,
        (SELECT count(*) FROM videos v
          JOIN caption_tracks ct ON ct.video_id = v.id AND ct.language = 'en'
          JOIN captions c ON c.track_id = ct.id
          WHERE v.deleted_at IS NULL AND v.status = 'ready' AND c.status IN ('draft', 'in_review')
            AND NOT EXISTS (SELECT 1 FROM captions n WHERE n.track_id = c.track_id AND n.revision > c.revision)) AS captions`);
    const row = rowsOf<{ encoding: string; captions: string }>(result)[0]!;
    return { encoding: Number(row.encoding), captions: Number(row.captions) };
  });
}
