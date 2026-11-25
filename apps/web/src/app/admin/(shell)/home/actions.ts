'use server';

import { revalidatePath } from 'next/cache';
import { homeService, videoService } from '@/lib/data/admin/services';
import { requireActionActor } from '@/lib/data/admin/session-next';
import { cleanHomeConfig as clean } from '@/lib/data/admin/home-clean';
import type { HomeConfig } from '@/lib/data/admin/home-rules';
import type { CommandResult, PreviewBackfillOutcome } from '@/lib/data/admin/video-commands';

async function run(
  fn: (a: Awaited<ReturnType<typeof requireActionActor>>) => Promise<CommandResult>,
) {
  const actor = await requireActionActor('/admin/home');
  const result = await fn(actor);
  revalidatePath('/admin/home');
  return result;
}

export async function saveHomeDraftAction(config: HomeConfig) {
  return run((a) => homeService.saveDraft(a, clean(config)));
}
export async function publishHomeAction(config: HomeConfig) {
  return run((a) => homeService.publish(a, clean(config)));
}
export async function restoreHomeAction() {
  return run((a) => homeService.restorePrevious(a));
}

/** Generate previews for all videos. Admins only, re-checked by the service (preview.backfill). */
export async function backfillPreviewsAction(): Promise<PreviewBackfillOutcome> {
  const actor = await requireActionActor('/admin/home');
  const result = await videoService.backfillPreviews(actor);
  revalidatePath('/admin', 'layout');
  return result;
}
