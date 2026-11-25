import type { Locator } from '@playwright/test';
import { goToScreen, highlight } from './helpers';
import type { Session } from './session';

/**
 * Small shared pieces for the Safety and kids episodes (K path). They live here and not in `episodes/` because every
 * file in that folder is an episode named after its id.
 */

/** Open a video from the Videos list by its title. Starts from any admin screen. */
export async function openVideoByTitle(s: Session, title: string): Promise<void> {
  await goToScreen(s, 'Videos');
  await s.page.getByRole('heading', { name: 'Videos' }).first().waitFor();
  await s.click(s.page.getByRole('link', { name: title, exact: true }).first());
  await s.page.getByRole('heading', { name: 'Details' }).waitFor();
  await s.pause(600);
}

/** Wait for the page to settle after a save, then hold so the viewer can read the message. */
export async function settle(s: Session, ms = 900): Promise<void> {
  await s.page.waitForLoadState('networkidle').catch(() => {});
  await s.pause(ms);
  // A toast sits over the corner of the page for 5 seconds. Wait it out so the next click is never caught by it.
  await s.page
    .locator('.adm-toast')
    .first()
    .waitFor({ state: 'hidden', timeout: 8000 })
    .catch(() => {});
}

/** Point at a block of text or a card and draw the highlight box. */
export async function pointAt(s: Session, target: Locator, holdMs = 1400): Promise<void> {
  await highlight(s, target, holdMs);
}

/**
 * Click a button that submits a plain form and loads a new page (Search, Filter). The usual click scans the page right
 * away, which can happen while the page is swapping, so this one waits for the new page first.
 */
export async function clickAndLoad(s: Session, target: Locator): Promise<void> {
  await s.reveal(target);
  await s.glide(target);
  await s.pause(450);
  await Promise.all([
    s.page.waitForLoadState('load').catch(() => {}),
    (async () => {
      await s.page.mouse.down();
      await s.pause(90);
      await s.page.mouse.up();
    })(),
  ]);
  await s.page.waitForLoadState('networkidle').catch(() => {});
  await s.pause(600);
  await s.guard('after a click');
}
