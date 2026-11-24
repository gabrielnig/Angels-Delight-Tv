'use server';

import { revalidatePath } from 'next/cache';
import type { Cue } from '@/lib/admin/cues';
import type { CaptionResult, SaveResult } from '@/lib/data/admin/caption-commands';
import { MAX_BULK_CALL, newBulkId, toOutcome, type BulkOutcome } from '@/lib/data/admin/bulk';
import { auditBulkRun } from '@/server/admin/bulk-run';
import { captionService } from '@/lib/data/admin/services';
import { requireActionActor } from '@/lib/data/admin/session-next';

const path = (id: string) => `/admin/captions/${id}`;

export async function saveCuesAction(videoId: string, cues: Cue[]): Promise<SaveResult> {
  const actor = await requireActionActor(path(videoId));
  // No revalidate on autosave: the editor holds the live copy and a refresh would fight it.
  return captionService.save(actor, videoId, cues);
}

export async function approveCaptionsAction(videoId: string): Promise<CaptionResult> {
  const actor = await requireActionActor(path(videoId));
  const result = await captionService.approve(actor, videoId);
  revalidatePath('/admin', 'layout');
  return result;
}

export async function regenerateCaptionsAction(videoId: string): Promise<CaptionResult> {
  const actor = await requireActionActor(path(videoId));
  const result = await captionService.regenerate(actor, videoId);
  revalidatePath('/admin', 'layout');
  return result;
}

export async function uploadCaptionsAction(videoId: string, cues: Cue[]): Promise<CaptionResult> {
  const actor = await requireActionActor(path(videoId));
  const result = await captionService.upload(actor, videoId, cues);
  revalidatePath('/admin', 'layout');
  return result;
}

export async function previewScriptAction(videoId: string, script: string): Promise<string> {
  const actor = await requireActionActor(path(videoId));
  return captionService.previewScript(actor, script);
}

export async function alignScriptAction(videoId: string, script: string): Promise<CaptionResult> {
  const actor = await requireActionActor(path(videoId));
  const result = await captionService.alignScript(actor, videoId, script);
  revalidatePath('/admin', 'layout');
  return result;
}

/** Approves up to MAX_BULK_CALL tracks. Admin only. Tracks with warnings are skipped, never forced. */
export async function bulkApproveCaptionsAction(
  ids: string[],
  bulkId: string = newBulkId(),
): Promise<BulkOutcome> {
  const actor = await requireActionActor('/admin/captions');
  const used = ids.slice(0, MAX_BULK_CALL);
  const result = await captionService.approveMany(actor, used);
  const outcome = toOutcome(result, bulkId);
  await auditBulkRun(
    { accountId: actor.accountId, role: actor.role },
    {
      action: 'caption.bulk_approve',
      label: 'Approve captions',
      targetType: 'video',
      bulkId,
      ids: used,
      outcome,
    },
  );
  revalidatePath('/admin', 'layout');
  return outcome;
}
