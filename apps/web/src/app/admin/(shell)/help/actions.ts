'use server';

import { requireActionActor } from '@/lib/data/admin/session-next';
import { helpProgress } from '@/lib/data/admin/help-progress';
import { panelFor, type PanelData } from '@/lib/admin/help-panel';
import { getLibrary, helpRole } from '@/server/help';
import { videoCues } from '@/server/help/video-block';

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

/** The guide for the screen the person is on, for the Help panel (M50-S03). Read only, and it never throws. */
export async function helpPanelAction(
  pathname: string,
  guide?: string,
): Promise<
  | { ok: true; data: PanelData; cues: { start: number; end: number; text: string }[] }
  | { ok: false }
> {
  const actor = await requireActionActor('/admin');
  if (typeof pathname !== 'string' || pathname.length > 200) return { ok: false };
  try {
    const library = getLibrary();
    const data = panelFor(library, helpRole(actor.role), pathname, guide);
    const main = data.guides[0] ? library.byId.get(data.guides[0].id) : undefined;
    return { ok: true, data, cues: main ? await videoCues(main) : [] };
  } catch {
    return { ok: false };
  }
}
