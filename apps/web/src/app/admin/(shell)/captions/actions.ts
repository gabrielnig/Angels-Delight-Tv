'use server';

import { revalidatePath } from 'next/cache';
import type { Cue } from '@/lib/admin/cues';
import type { CaptionResult, SaveResult } from '@/lib/data/admin/caption-commands';
import { MAX_BULK_CALL, newBulkId, toOutcome, type BulkOutcome } from '@/lib/data/admin/bulk';
import { auditBulkRun } from '@/server/admin/bulk-run';
import { captionService } from '@/lib/data/admin/services';
import { requireActionActor } from '@/lib/data/admin/session-next';

const path = (id: string) => `/admin/captions/${id}`;

/** `language` is the track being edited. Undefined means the language spoken in the video. */
export async function saveCuesAction(
  videoId: string,
  language: string | undefined,
  cues: Cue[],
): Promise<SaveResult> {
  const actor = await requireActionActor(path(videoId));
  // No revalidate on autosave: the editor holds the live copy and a refresh would fight it.
  return captionService.save(actor, videoId, cues, language);
}

export async function approveCaptionsAction(
  videoId: string,
  language?: string,
): Promise<CaptionResult> {
  const actor = await requireActionActor(path(videoId));
  const result = await captionService.approve(actor, videoId, language);
  revalidatePath('/admin', 'layout');
  return result;
}

export async function regenerateCaptionsAction(videoId: string): Promise<CaptionResult> {
  const actor = await requireActionActor(path(videoId));
  const result = await captionService.regenerate(actor, videoId);
  revalidatePath('/admin', 'layout');
  return result;
}

export async function uploadCaptionsAction(
  videoId: string,
  language: string | undefined,
  cues: Cue[],
): Promise<CaptionResult> {
  const actor = await requireActionActor(path(videoId));
  const result = await captionService.upload(actor, videoId, cues, language);
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

/** Queues a machine translation draft. It opens in review and never goes live by itself. */
export async function translateCaptionsAction(videoId: string, language: string): Promise<CaptionResult> {
  const actor = await requireActionActor(path(videoId));
  const result = await captionService.translate(actor, videoId, language);
  revalidatePath('/admin', 'layout');
  return result;
}

export async function estimateTranslationAction(videoId: string, language: string) {
  const actor = await requireActionActor(path(videoId));
  return captionService.estimate(actor, videoId, language);
}

/** The per language Publish switch. Admin only, audited by the service. */
export async function publishLanguageAction(
  videoId: string,
  language: string,
  published: boolean,
): Promise<CaptionResult> {
  const actor = await requireActionActor(path(videoId));
  const result = await captionService.setPublished(actor, videoId, language, published);
  revalidatePath('/admin', 'layout');
  return result;
}
