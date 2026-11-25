import { eq, sql } from 'drizzle-orm';
import { videos, withAccount } from '@ad/db';
import { Forbidden, isStaffRole, isUuid, roleAtLeast, type Actor } from '@ad/shared';
import { writeAudit } from '../audit';
import { rowsOf } from '../sql';
import { OK, fail, type AdminContext, type CommandResult } from './types';

/** Default length of a hero clip. Mirrors `PREVIEW_CLIP_MS` in `@ad/video`, which the catalog package does not import. */
const DEFAULT_CLIP_MS = 20_000;
/** The most videos one press of Generate previews for all videos queues. A second press carries on. */
export const PREVIEW_BACKFILL_LIMIT = 500;

const clipMsOf = (ctx: AdminContext) => ctx.heroClipMs ?? DEFAULT_CLIP_MS;

export type PreviewModeInput =
  { mode: 'auto' } | { mode: 'off' } | { mode: 'picked'; startMs?: number };

/** Queues the clip job. `JobProducer.enqueue` fits this shape and tests pass a recorder. */
export type PreviewEnqueue = (
  queue: 'video.preview',
  payload: { videoId: string; mode?: 'auto' | 'picked'; startMs?: number },
  options?: { createdBy?: string },
) => Promise<unknown>;

const clock = (ms: number) => `${Math.floor(ms / 60_000)}:${String(Math.floor((ms % 60_000) / 1000)).padStart(2, '0')}`;

function assertStaff(actor: Actor): void {
  if (!isStaffRole(actor.role)) throw new Forbidden('Editors only');
}

/**
 * Chooses how a video's Home hero clip is made: automatic, a picked start (whole seconds are not required, 100 ms
 * steps are) or off. Automatic and picked queue a fresh clip. Off keeps any clip file but the viewer no longer gets it.
 */
export async function setAdminPreviewMode(
  ctx: AdminContext,
  actor: Actor,
  videoId: string,
  input: PreviewModeInput,
  enqueue: PreviewEnqueue,
): Promise<CommandResult> {
  assertStaff(actor);
  if (!isUuid(videoId)) return fail('That video no longer exists.');
  const queued = await withAccount(ctx.db, actor, async (tx) => {
    const [video] = await tx
      .select({
        title: videos.title,
        durationMs: videos.durationMs,
        mode: videos.previewMode,
        start: videos.previewStartMs,
      })
      .from(videos)
      .where(eq(videos.id, videoId))
      .for('update');
    if (!video) return fail('That video no longer exists.');
    let startMs: number | null = null;
    if (input.mode === 'picked') {
      const latest = Math.max(0, (video.durationMs ?? 0) - clipMsOf(ctx));
      const start = input.startMs;
      if (start === undefined || !Number.isInteger(start) || start < 0 || start > latest || start % 100 !== 0)
        return fail(`Pick a start between 0:00 and ${clock(latest)} so the clip has ${clipMsOf(ctx) / 1000} seconds to play`);
      startMs = start;
    }
    await tx
      .update(videos)
      .set({
        previewMode: input.mode,
        previewStartMs: startMs,
        ...(input.mode === 'off' ? {} : { previewState: 'queued', previewNote: null }),
        previewUpdatedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(videos.id, videoId));
    await writeAudit(tx, {
      action: 'video.preview_mode',
      outcome: 'success',
      actorAccountId: actor.accountId,
      actorRole: actor.role,
      targetType: 'video',
      targetId: videoId,
      summary: `Hero preview clip set to ${input.mode} for ${video.title}`,
      before: { previewMode: video.mode, previewStartMs: video.start },
      after: { previewMode: input.mode, previewStartMs: startMs },
    });
    return input.mode === 'off'
      ? null
      : ({ mode: input.mode, ...(startMs !== null ? { startMs } : {}) } as const);
  });
  if (queued && 'ok' in queued) return queued;
  if (queued) await enqueue('video.preview', { videoId, ...queued }, { createdBy: actor.accountId });
  return OK;
}

/** Retry for a failed or skipped clip, or a recut on request. Works on unpublished videos too. */
export async function recutAdminPreview(
  ctx: AdminContext,
  actor: Actor,
  videoId: string,
  enqueue: PreviewEnqueue,
): Promise<CommandResult> {
  assertStaff(actor);
  if (!isUuid(videoId)) return fail('That video no longer exists.');
  const payload = await withAccount(ctx.db, actor, async (tx) => {
    const [video] = await tx
      .select({ title: videos.title, mode: videos.previewMode, start: videos.previewStartMs })
      .from(videos)
      .where(eq(videos.id, videoId))
      .for('update');
    if (!video) return fail('That video no longer exists.');
    if (video.mode === 'off') return fail('Turn the preview clip on first');
    await tx
      .update(videos)
      .set({ previewState: 'queued', previewNote: null, previewUpdatedAt: sql`now()`, updatedAt: new Date() })
      .where(eq(videos.id, videoId));
    await writeAudit(tx, {
      action: 'video.preview_retry',
      outcome: 'success',
      actorAccountId: actor.accountId,
      actorRole: actor.role,
      targetType: 'video',
      targetId: videoId,
      summary: `Hero preview clip queued again for ${video.title}`,
    });
    return {
      videoId,
      mode: video.mode === 'picked' ? ('picked' as const) : ('auto' as const),
      ...(video.mode === 'picked' && video.start !== null ? { startMs: video.start } : {}),
    };
  });
  if ('ok' in payload) return payload;
  await enqueue('video.preview', payload, { createdBy: actor.accountId });
  return OK;
}

export type PreviewBackfillResult =
  | { ok: true; queued: number; current: number }
  | { ok: false; error: string };

/**
 * Generate previews for all videos (M41, D-355). Queues the existing `video.preview` job for every published, ready
 * video that has its original, is not set to off, and has no clip that fits today's settings: no clip yet, a failed
 * or skipped one, a clip made before sound and a recorded length existed, a clip whose length no longer matches the
 * clip length setting, or a job stuck as queued for over an hour. Each video is marked queued in the same step, so
 * pressing again never queues one twice. Admins only. Queues at most `PREVIEW_BACKFILL_LIMIT` videos per press.
 */
export async function queueAdminPreviewBackfill(
  ctx: AdminContext,
  actor: Actor,
  enqueue: PreviewEnqueue,
): Promise<PreviewBackfillResult> {
  if (!roleAtLeast(actor.role, 'admin')) throw new Forbidden('Admins only');
  const clipMs = clipMsOf(ctx);
  const due = await withAccount(ctx.db, actor, async (tx) => {
    const result = await tx.execute(sql`
      WITH wanted AS (
        SELECT id FROM videos
        WHERE deleted_at IS NULL AND status = 'ready' AND publish_state = 'published'
          AND original_key IS NOT NULL AND preview_mode <> 'off'
          AND (
            preview_state IN ('none', 'failed', 'skipped')
            OR (preview_state = 'queued' AND updated_at < now() - interval '1 hour')
            OR (preview_state = 'ready' AND (
              preview_length_ms IS NULL
              OR abs(preview_length_ms - LEAST(COALESCE(duration_ms, ${clipMs}), ${clipMs})) > 1000))
          )
        ORDER BY updated_at
        LIMIT ${PREVIEW_BACKFILL_LIMIT}
        FOR UPDATE
      )
      UPDATE videos v
      SET preview_state = 'queued', preview_note = NULL, preview_updated_at = now(), updated_at = now()
      FROM wanted
      WHERE v.id = wanted.id
      RETURNING v.id, v.preview_mode, v.preview_start_ms`);
    const queued = rowsOf<{ id: string; preview_mode: string; preview_start_ms: number | null }>(result);
    const [counted] = rowsOf<{ total: number }>(
      await tx.execute(sql`
        SELECT count(*)::int AS total FROM videos
        WHERE deleted_at IS NULL AND status = 'ready' AND publish_state = 'published'
          AND original_key IS NOT NULL AND preview_mode <> 'off'`),
    );
    const total = counted?.total ?? 0;
    await writeAudit(tx, {
      action: 'video.preview_backfill',
      outcome: 'success',
      actorAccountId: actor.accountId,
      actorRole: actor.role,
      targetType: 'video',
      targetId: null,
      summary: `Hero preview clips queued for ${queued.length} videos`,
      after: { queued: queued.length, clipMs },
    });
    return { queued, current: Math.max(0, total - queued.length) };
  });
  for (const row of due.queued) {
    await enqueue(
      'video.preview',
      {
        videoId: row.id,
        mode: row.preview_mode === 'picked' ? 'picked' : 'auto',
        ...(row.preview_mode === 'picked' && row.preview_start_ms !== null ? { startMs: row.preview_start_ms } : {}),
      },
      { createdBy: actor.accountId },
    );
  }
  return { ok: true, queued: due.queued.length, current: due.current };
}
