'use server';

import { revalidatePath } from 'next/cache';
import { videoService } from '@/lib/data/admin/services';
import { requireActionActor } from '@/lib/data/admin/session-next';
import { MAX_BULK_CALL, MAX_SELECTION, newBulkId, toOutcome, type BulkUndo } from '@/lib/data/admin/bulk';
import { runVideoBulk, undoVideoBulk } from '@/lib/data/admin/video-bulk';
import type { BulkAction, BulkResult, VideoQuery } from '@/lib/data/admin/video-queries';
import { auditBulkRun } from '@/server/admin/bulk-run';
import type { CleanupResult } from '@/lib/data/admin/types';
import type { CommandResult } from '@/lib/data/admin/video-commands';

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
