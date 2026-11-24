import { eq, sql } from 'drizzle-orm';
import { videos, withAccount } from '@ad/db';
import { Forbidden, isStaffRole, isUuid, type Actor } from '@ad/shared';
import { writeAudit } from '../audit';
import { OK, fail, type AdminContext, type CommandResult } from './types';

/** Length of a hero clip. Mirrors `PREVIEW_CLIP_MS` in `@ad/video`, which the catalog package does not import. */
const CLIP_MS = 6000;

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
      const latest = Math.max(0, (video.durationMs ?? 0) - CLIP_MS);
      const start = input.startMs;
      if (start === undefined || !Number.isInteger(start) || start < 0 || start > latest || start % 100 !== 0)
        return fail(`Pick a start between 0:00 and ${clock(latest)} so the clip has six seconds to play`);
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
