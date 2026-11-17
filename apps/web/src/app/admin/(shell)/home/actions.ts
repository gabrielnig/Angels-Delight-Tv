'use server';

import { revalidatePath } from 'next/cache';
import { homeService } from '@/lib/data/admin/services';
import { requireActor } from '@/lib/data/admin/session-next';
import type { HomeConfig } from '@/lib/data/admin/home-rules';
import type { CommandResult } from '@/lib/data/admin/video-commands';

/** The client sends plain JSON. Rebuild it field by field so nothing unexpected is stored. */
function clean(input: HomeConfig): HomeConfig {
  return {
    heroIds: (Array.isArray(input?.heroIds) ? input.heroIds : []).map(String).slice(0, 50),
    rows: (Array.isArray(input?.rows) ? input.rows : []).slice(0, 50).map((r) => ({
      id: String(r.id),
      type: r.type,
      name: String(r.name ?? ''),
      visible: Boolean(r.visible),
      videoIds: (Array.isArray(r.videoIds) ? r.videoIds : []).map(String).slice(0, 50),
      sourceId: r.sourceId ? String(r.sourceId) : null,
    })),
  };
}

async function run(fn: (a: Awaited<ReturnType<typeof requireActor>>) => Promise<CommandResult>) {
  const actor = await requireActor('/admin/home');
  const result = await fn(actor);
  revalidatePath('/admin/home');
  return result;
}

export const saveHomeDraftAction = (config: HomeConfig) =>
  run((a) => homeService.saveDraft(a, clean(config)));
export const publishHomeAction = (config: HomeConfig) =>
  run((a) => homeService.publish(a, clean(config)));
export const restoreHomeAction = () => run((a) => homeService.restorePrevious(a));
