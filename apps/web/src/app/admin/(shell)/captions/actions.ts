'use server';

import { revalidatePath } from 'next/cache';
import type { Cue } from '@/lib/admin/cues';
import type { CaptionResult, SaveResult } from '@/lib/data/admin/caption-commands';
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
