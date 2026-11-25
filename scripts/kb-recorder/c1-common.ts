import type { Locator } from '@playwright/test';
import type { Step } from './episode';
import { goToScreen } from './helpers';
import type { Session } from './session';

/**
 * Small builders for the Start here and Daily tasks episodes (lane C1). Each returns a plain Step, so an episode still
 * reads top to bottom. They find controls by role and visible label, like helpers.ts.
 */

/** "Choose X in the side menu": opens the screen and waits for its heading. */
export function navStep(
  label: string,
  caption: string,
  o: { heading?: string; shot?: { name: string; alt: string }; holdMs?: number } = {},
): Step {
  const heading = o.heading ?? label;
  const target = (s: Session): Locator => s.page.getByRole('heading', { name: heading }).first();
  return {
    caption,
    holdMs: o.holdMs ?? 3000,
    run: async (s) => {
      await goToScreen(s, label);
      await target(s).waitFor();
    },
    ...(o.shot ? { shot: { name: o.shot.name, alt: o.shot.alt, marks: [{ target, label: heading }] } } : {}),
  };
}

/** A look at something already on the screen: the pointer moves to it and a box is drawn round it. */
export function lookStep(
  caption: string,
  target: (s: Session) => Locator,
  o: { holdMs?: number; shot?: { name: string; alt: string; label?: string } } = {},
): Step {
  return {
    caption,
    holdMs: o.holdMs ?? 3400,
    run: async (s) => {
      const t = target(s);
      await t.first().waitFor();
      await s.point(t.first());
    },
    ...(o.shot
      ? { shot: { name: o.shot.name, alt: o.shot.alt, marks: [{ target, label: o.shot.label ?? 'Look here' }] } }
      : {}),
  };
}

/** A small valid looking MP4 name for uploads. The simulated upload of the fixture build only reads the size. */
export const DEMO_UPLOAD = { name: 'demo_lesson.mp4', mimeType: 'video/mp4', buffer: Buffer.alloc(40 * 1024 * 1024) };

/**
 * The link that opens a row. On a desktop it is the Edit or Review button of the table row. On a phone the list is a
 * stack of cards and the title is the link, so the same step reads the same on both.
 */
export function rowLink(s: Session, desktopName: string, title: string): Locator {
  return s.profile.mobile
    ? s.page.getByRole('link', { name: title, exact: true }).first()
    : s.page.getByRole('link', { name: desktopName, exact: true });
}
