'use server';

import { revalidatePath } from 'next/cache';
import { videoService } from '@/lib/data/admin/services';
import { requireActor } from '@/lib/data/admin/session-next';
import type { BulkAction, BulkResult } from '@/lib/data/admin/video-queries';
import type { CommandResult } from '@/lib/data/admin/video-commands';

export async function bulkVideosAction(ids: string[], action: BulkAction): Promise<BulkResult> {
  const actor = await requireActor('/admin/videos');
  const result = await videoService.bulk(actor, ids.slice(0, 200), action);
  revalidatePath('/admin', 'layout');
  return result;
}

export async function restoreVideoAction(id: string): Promise<CommandResult> {
  const actor = await requireActor('/admin/videos/trash');
  const result = await videoService.restore(actor, id);
  revalidatePath('/admin', 'layout');
  return result;
}

export async function purgeVideoAction(id: string): Promise<CommandResult> {
  const actor = await requireActor('/admin/videos/trash');
  const result = await videoService.purge(actor, id);
  revalidatePath('/admin', 'layout');
  return result;
}

export async function retryEncodeAction(id: string): Promise<CommandResult> {
  const actor = await requireActor('/admin/encoding');
  const result = await videoService.retryEncode(actor, id);
  revalidatePath('/admin', 'layout');
  return result;
}

export async function registerUploadAction(
  name: string,
  sizeBytes: number,
): Promise<{ id: string }> {
  const actor = await requireActor('/admin/videos/upload');
  const result = await videoService.createFromUpload(actor, {
    name: String(name).slice(0, 200),
    sizeBytes: Number(sizeBytes) || 0,
  });
  revalidatePath('/admin', 'layout');
  return result;
}
