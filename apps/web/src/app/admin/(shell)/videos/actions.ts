'use server';

import { revalidatePath } from 'next/cache';
import { videoService } from '@/lib/data/admin/services';
import { requireActionActor } from '@/lib/data/admin/session-next';
import { MAX_BULK_CALL, MAX_SELECTION, newBulkId, toOutcome, type BulkOutcome, type BulkUndo } from '@/lib/data/admin/bulk';
import { runCleanupMany } from '@/lib/data/admin/encode-bulk';
import { runVideoBulk, undoRestoreVideos, undoVideoBulk } from '@/lib/data/admin/video-bulk';
import type { BulkAction, BulkResult, VideoQuery } from '@/lib/data/admin/video-queries';
import { auditBulkRun } from '@/server/admin/bulk-run';
import type { CleanupResult } from '@/lib/data/admin/types';
import type { CommandResult, VideoPatch } from '@/lib/data/admin/video-commands';

export async function bulkVideosAction(
  ids: string[],
  action: BulkAction,
  bulkId: string = newBulkId(),
): Promise<BulkResult> {
  const actor = await requireActionActor('/admin/videos');
  const used = ids.slice(0, MAX_BULK_CALL);
  const result = await runVideoBulk(videoService, actor, used, action, bulkId);
  await auditBulkRun(
    { accountId: actor.accountId, role: actor.role },
    { action: `video.bulk_${action.type}`, label: bulkLabel(action), targetType: 'video', bulkId, ids: used, outcome: toOutcome(result, bulkId) },
  );
  revalidatePath('/admin', 'layout');
  return result;
}

export async function undoBulkVideosAction(undo: BulkUndo): Promise<BulkResult> {
  const actor = await requireActionActor('/admin/videos');
  const result = await undoVideoBulk(videoService, actor, undo);
  revalidatePath('/admin', 'layout');
  return result;
}

/** Ids of up to MAX_SELECTION videos that match a filter, newest first, for "Select all that match". */
export async function matchingVideoIdsAction(query: VideoQuery): Promise<string[]> {
  const actor = await requireActionActor('/admin/videos');
  const ids: string[] = [];
  let cursor: string | undefined;
  while (ids.length < MAX_SELECTION + 1) {
    const page = await videoService.list(actor, { ...query, limit: 100, cursor });
    ids.push(...page.items.map((v) => v.id));
    if (!page.nextCursor) break;
    cursor = page.nextCursor;
  }
  return ids.slice(0, MAX_SELECTION + 1);
}

export async function restoreVideoAction(id: string): Promise<CommandResult> {
  const actor = await requireActionActor('/admin/videos/trash');
  const result = await videoService.restore(actor, id);
  revalidatePath('/admin', 'layout');
  return result;
}

export async function purgeVideoAction(id: string): Promise<CommandResult> {
  const actor = await requireActionActor('/admin/videos/trash');
  const result = await videoService.purge(actor, id);
  revalidatePath('/admin', 'layout');
  return result;
}

export async function retryEncodeAction(id: string): Promise<CommandResult> {
  const actor = await requireActionActor('/admin/encoding');
  const result = await videoService.retryEncode(actor, id);
  revalidatePath('/admin', 'layout');
  return result;
}

export async function cleanupFailedAction(id: string): Promise<CleanupResult> {
  const actor = await requireActionActor('/admin/encoding/failed');
  const result = await videoService.cleanupFailed(actor, id);
  revalidatePath('/admin', 'layout');
  return result;
}

export async function cleanupAllFailedAction(): Promise<CleanupResult> {
  const actor = await requireActionActor('/admin/encoding/failed');
  const result = await videoService.cleanupAllFailed(actor);
  revalidatePath('/admin', 'layout');
  return result;
}

export async function registerUploadAction(
  name: string,
  sizeBytes: number,
): Promise<{ id: string }> {
  const actor = await requireActionActor('/admin/videos/upload');
  const result = await videoService.createFromUpload(actor, {
    name: String(name).slice(0, 200),
    sizeBytes: Number(sizeBytes) || 0,
  });
  revalidatePath('/admin', 'layout');
  return result;
}

function bulkLabel(action: BulkAction): string {
  switch (action.type) {
    case 'publish':
      return 'Publish';
    case 'unpublish':
      return 'Unpublish';
    case 'trash':
      return 'Move to Trash';
    case 'category':
      return 'Add to category';
    case 'remove_category':
      return 'Remove from category';
    case 'suitability':
      return 'Set suitability';
    case 'captions_available':
      return 'Captions for viewers';
  }
}

/** Retries failed encodes, oldest failure first. Editors may retry (encode.retry). */
export async function bulkRetryEncodesAction(
  ids: string[],
  bulkId: string = newBulkId(),
): Promise<BulkOutcome> {
  const actor = await requireActionActor('/admin/encoding');
  const used = ids.slice(0, MAX_BULK_CALL);
  const outcome = toOutcome(await videoService.retryEncodeMany(actor, used, bulkId), bulkId);
  await auditBulkRun(
    { accountId: actor.accountId, role: actor.role },
    { action: 'video.bulk_retry', label: 'Retry encodes', targetType: 'video', bulkId, ids: used, outcome },
  );
  revalidatePath('/admin', 'layout');
  return outcome;
}

/** Removes leftover files of the chosen failed encodes. Originals and captions are never touched. */
export async function bulkCleanupFailedAction(
  ids: string[],
  bulkId: string = newBulkId(),
): Promise<BulkOutcome> {
  const actor = await requireActionActor('/admin/encoding/failed');
  const used = ids.slice(0, MAX_BULK_CALL);
  const done = await runCleanupMany((id) => videoService.cleanupFailed(actor, id), used);
  const outcome = toOutcome({ succeeded: done.succeeded, failed: done.failed }, bulkId);
  await auditBulkRun(
    { accountId: actor.accountId, role: actor.role },
    { action: 'video.bulk_cleanup', label: 'Clean up failed encodes', targetType: 'video', bulkId, ids: used, outcome },
  );
  revalidatePath('/admin', 'layout');
  return outcome;
}

/** Restores videos from Trash as Drafts. The outcome carries an undo that moves them back. */
export async function bulkRestoreVideosAction(
  ids: string[],
  bulkId: string = newBulkId(),
): Promise<BulkOutcome> {
  const actor = await requireActionActor('/admin/videos/trash');
  const used = ids.slice(0, MAX_BULK_CALL);
  const done = await videoService.restoreMany(actor, used);
  const outcome = toOutcome(
    {
      ...done,
      undo: done.succeeded.length
        ? { label: 'Restore. Undo moves the videos back to Trash.', payload: done.succeeded }
        : undefined,
    },
    bulkId,
  );
  await auditBulkRun(
    { accountId: actor.accountId, role: actor.role },
    { action: 'video.bulk_restore', label: 'Restore from Trash', targetType: 'video', bulkId, ids: used, outcome },
  );
  revalidatePath('/admin', 'layout');
  return outcome;
}

export async function undoBulkRestoreAction(ids: string[]): Promise<BulkResult> {
  const actor = await requireActionActor('/admin/videos/trash');
  const result = await undoRestoreVideos(videoService, actor, ids.slice(0, MAX_BULK_CALL));
  revalidatePath('/admin', 'layout');
  return result;
}

/** Queues each chosen video for deletion forever. Admin only. No undo. */
export async function bulkPurgeVideosAction(
  ids: string[],
  bulkId: string = newBulkId(),
): Promise<BulkOutcome> {
  const actor = await requireActionActor('/admin/videos/trash');
  const used = ids.slice(0, MAX_BULK_CALL);
  const outcome = toOutcome(await videoService.purgeMany(actor, used), bulkId);
  await auditBulkRun(
    { accountId: actor.accountId, role: actor.role },
    { action: 'video.bulk_purge', label: 'Delete forever', targetType: 'video', bulkId, ids: used, outcome },
  );
  revalidatePath('/admin', 'layout');
  return outcome;
}

/**
 * Saves the shared upload details onto a new draft (M42-S18). Same validation as the video editor, so a
 * category that vanished or a bad episode number comes back as a plain message.
 */
export async function applyUploadDetailsAction(
  videoId: string,
  patch: VideoPatch,
): Promise<{ ok: boolean; error?: string }> {
  const actor = await requireActionActor('/admin/videos/upload');
  const clean: VideoPatch = {
    ...(typeof patch.title === 'string' ? { title: patch.title.slice(0, 120) } : {}),
    ...(Array.isArray(patch.categoryIds) ? { categoryIds: patch.categoryIds.map(String).slice(0, 50) } : {}),
    ...(patch.suitability ? { suitability: patch.suitability } : {}),
    ...(Array.isArray(patch.tags) ? { tags: patch.tags.map(String).slice(0, 10) } : {}),
    ...(typeof patch.seriesId === 'string' ? { seriesId: patch.seriesId } : {}),
    ...(typeof patch.episodeNumber === 'number' ? { episodeNumber: patch.episodeNumber } : {}),
  };
  try {
    await videoService.update(actor, String(videoId), clean);
  } catch (error) {
    const fields = (error as { fields?: Record<string, string[]> }).fields;
    const first = fields ? Object.values(fields)[0]?.[0] : undefined;
    return { ok: false, error: first ?? 'Details were not saved. Open the video to set them.' };
  }
  revalidatePath('/admin', 'layout');
  return { ok: true };
}
