'use server';

import { requireActionActor } from '@/lib/data/admin/session-next';
import { helpProgress } from '@/lib/data/admin/help-progress';
import { getLibrary } from '@/server/help';

type Saved = { ok: boolean };

async function guarded(
  guide: string,
  task: (actor: Awaited<ReturnType<typeof requireActionActor>>) => Promise<void>,
): Promise<Saved> {
  const actor = await requireActionActor(`/admin/help/${guide}`);
  if (!getLibrary().byId.has(guide)) return { ok: false };
  try {
    await task(actor);
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

/** Mark a guide done or not done. Only the person's own progress changes (M50-S25). */
export async function setGuideDoneAction(guide: string, done: boolean): Promise<Saved> {
  return guarded(guide, (actor) => helpProgress.setGuideDone(actor, guide, done));
}

/** One tap Was this helpful answer, stored per account and nothing else (M50-S26). */
export async function setHelpfulAction(guide: string, helpful: boolean): Promise<Saved> {
  return guarded(guide, (actor) => helpProgress.setHelpful(actor, guide, helpful));
}

/** The video reached 90 percent or the person chose Mark as watched (M50-S25). */
export async function markVideoWatchedAction(guide: string): Promise<Saved> {
  return guarded(guide, (actor) => helpProgress.markVideoWatched(actor, guide));
}
