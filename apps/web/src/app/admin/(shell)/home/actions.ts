'use server';

import { revalidatePath } from 'next/cache';
import { homeService } from '@/lib/data/admin/services';
import { requireActionActor } from '@/lib/data/admin/session-next';
import { cleanHomeConfig as clean } from '@/lib/data/admin/home-clean';
import type { HomeConfig } from '@/lib/data/admin/home-rules';
import type { CommandResult } from '@/lib/data/admin/video-commands';

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
