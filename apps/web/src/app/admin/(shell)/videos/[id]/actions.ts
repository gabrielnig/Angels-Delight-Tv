'use server';

import { revalidatePath } from 'next/cache';
import { ValidationFailed } from '@ad/shared';
import type { PosterChoice } from '@/lib/admin/poster-rules';
import { videoService } from '@/lib/data/admin/services';
import { requireActionActor } from '@/lib/data/admin/session-next';
import type { BulkAction, BulkResult } from '@/lib/data/admin/video-queries';
import type { CommandResult, PublishRequest, VideoPatch } from '@/lib/data/admin/video-commands';

export async function updateVideoAction(
  id: string,
  patch: VideoPatch,
): Promise<{ ok: true } | { ok: false; errors: Record<string, string> }> {
  const actor = await requireActionActor(`/admin/videos/${id}`);
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
  const actor = await requireActionActor(`/admin/videos/${id}`);
  const result = await videoService.publish(actor, id, request);
  revalidatePath('/admin', 'layout');
  return result;
}

export async function unpublishVideoAction(id: string): Promise<CommandResult> {
  const actor = await requireActionActor(`/admin/videos/${id}`);
  const result = await videoService.unpublish(actor, id);
  revalidatePath('/admin', 'layout');
  return result;
}

export async function setCaptionsAction(
  id: string,
  value: boolean | null,
  reason?: string,
): Promise<CommandResult> {
  const actor = await requireActionActor(`/admin/videos/${id}`);
  const result = await videoService.setCaptionsAvailability(actor, id, value, reason);
  revalidatePath('/admin', 'layout');
  return result;
}

export async function retryEncodeVideoAction(id: string): Promise<CommandResult> {
  const actor = await requireActionActor(`/admin/videos/${id}`);
  const result = await videoService.retryEncode(actor, id);
  revalidatePath('/admin', 'layout');
  return result;
}

export async function trashVideoAction(id: string, action: BulkAction): Promise<BulkResult> {
  const actor = await requireActionActor(`/admin/videos/${id}`);
  const result = await videoService.bulk(actor, [id], action);
  revalidatePath('/admin', 'layout');
  return result;
}

export async function setPosterAction(id: string, choice: PosterChoice): Promise<CommandResult> {
  const actor = await requireActionActor(`/admin/videos/${id}/poster`);
  const result = await videoService.setPoster(actor, id, choice);
  revalidatePath('/admin', 'layout');
  return result;
}

const UPLOAD_ERROR = 'Could not upload the poster. Try again.';

export async function uploadPosterAction(
  id: string,
  formData: FormData,
): Promise<{ ok: true; assetId: string } | { ok: false; error: string }> {
  const actor = await requireActionActor(`/admin/videos/${id}/poster`);
  const file = formData.get('file');
  if (!(file instanceof File)) return { ok: false, error: UPLOAD_ERROR };
  const result = await videoService.uploadPoster(
    actor,
    id,
    new Uint8Array(await file.arrayBuffer()),
  );
  if (result.ok) revalidatePath(`/admin/videos/${id}/poster`);
  return result;
}

export async function posterStatusAction(
  id: string,
  assetId: string,
): Promise<{ status: 'processing' | 'ready' | 'failed' }> {
  const actor = await requireActionActor(`/admin/videos/${id}/poster`);
  return videoService.posterStatus(actor, assetId);
}
