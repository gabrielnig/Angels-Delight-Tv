import type { Locator } from '@playwright/test';
import type { ShotMark } from './episode';
import { clickByName, goToScreen, highlight, scrollTo, waitForToast } from './helpers';
import type { Session } from './session';

/** Shared moves for the Setup and settings episodes (lane C3). Each finds controls by role and visible label. */

export const openSiteSettings = (s: Session) => goToScreen(s, 'Site settings');

/** Open one tab of Site settings. */
export async function openTab(s: Session, name: string) {
  const tab = s.page.getByRole('tab', { name, exact: true });
  await tab.scrollIntoViewIfNeeded();
  await s.click(tab);
  await s.page.getByRole('tabpanel').first().waitFor();
}

export const saveChanges = (s: Session) => clickByName(s, 'button', 'Save changes');

export const checklist = (s: Session): Locator => s.page.getByRole('complementary', { name: 'Launch checklist' });

/** A numbered mark on a control found by its label. */
export const markLabel = (label: string, text: string, role: 'textbox' | 'button' | 'tab' | 'switch' | 'link' = 'textbox'): ShotMark => ({
  target: (s) => s.page.getByRole(role, { name: label, exact: true }).first(),
  label: text,
});

export const markText = (text: string, label: string): ShotMark => ({
  target: (s) => s.page.getByText(text, { exact: false }).first(),
  label,
});

/** Clears the box first so a number is never appended to the old value, then types at reading pace. */
export async function typeInto(s: Session, label: string, text: string): Promise<void> {
  const field = s.page.getByLabel(label, { exact: true }).first();
  await field.waitFor({ state: 'visible', timeout: 10_000 });
  await s.click(field);
  await field.press('Control+A');
  await field.press('Backspace');
  await s.type(field, text);
}

export { clickByName, highlight, scrollTo, waitForToast, goToScreen };

/** Gives every step a minimum hold so a short procedure still reads comfortably and reaches about a minute. */
export function padSteps<T extends { holdMs?: number }>(steps: T[], ms = 3400): T[] {
  return steps.map((st) => ({ ...st, holdMs: Math.max(st.holdMs ?? 0, ms) }));
}
