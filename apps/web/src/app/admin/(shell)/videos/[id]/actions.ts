'use server';

import { revalidatePath } from 'next/cache';
import { ValidationFailed } from '@ad/shared';
import type { PosterChoice } from '@/lib/admin/poster-rules';
import { videoService } from '@/lib/data/admin/services';
import { requireActor } from '@/lib/data/admin/session-next';
import type { BulkAction, BulkResult } from '@/lib/data/admin/video-queries';
import type { CommandResult, PublishRequest, VideoPatch } from '@/lib/data/admin/video-commands';

export async function updateVideoAction(
  id: string,
  patch: VideoPatch,
): Promise<{ ok: true } | { ok: false; errors: Record<string, string> }> {
  const actor = await requireActor(`/admin/videos/${id}`);
  try {
    await videoService.update(actor, id, patch);
  } catch (error) {
    if (error instanceof ValidationFailed) {
      return {
        ok: false,
        errors: Object.fromEntries(Object.entries(error.fields).map(([k, v]) => [k, v[0] ?? ''])),
      };
    }
    throw error;
  }
  revalidatePath('/admin', 'layout');
  return { ok: true };
}

export async function publishVideoAction(
  id: string,
  request: PublishRequest,
): Promise<CommandResult> {
  const actor = await requireActor(`/admin/videos/${id}`);
  const result = await videoService.publish(actor, id, request);
  revalidatePath('/admin', 'layout');
  return result;
}

export async function unpublishVideoAction(id: string): Promise<CommandResult> {
  const actor = await requireActor(`/admin/videos/${id}`);
  const result = await videoService.unpublish(actor, id);
  revalidatePath('/admin', 'layout');
  return result;
}

export async function retryEncodeVideoAction(id: string): Promise<CommandResult> {
  const actor = await requireActor(`/admin/videos/${id}`);
  const result = await videoService.retryEncode(actor, id);
  revalidatePath('/admin', 'layout');
  return result;
}

export async function trashVideoAction(id: string, action: BulkAction): Promise<BulkResult> {
  const actor = await requireActor(`/admin/videos/${id}`);
  const result = await videoService.bulk(actor, [id], action);
  revalidatePath('/admin', 'layout');
  return result;
}

export async function setPosterAction(id: string, choice: PosterChoice): Promise<CommandResult> {
  const actor = await requireActor(`/admin/videos/${id}/poster`);
  const result = await videoService.setPoster(actor, id, choice);
  revalidatePath('/admin', 'layout');
  return result;
}
