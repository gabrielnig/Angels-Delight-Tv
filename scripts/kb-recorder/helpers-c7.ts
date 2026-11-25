import type { Session } from './session';

/** Open a side menu item whose accessible name has a count after the label (for example "Encoding1 need attention"). */
export async function menuTo(s: Session, label: string): Promise<void> {
  if (s.profile.mobile) {
    const open = s.page.getByRole('button', { name: 'Open menu' });
    if (await open.isVisible().catch(() => false)) await s.click(open);
  }
  const link = s.page.getByRole('link', { name: new RegExp(`^${label}`) }).first();
  await link.waitFor({ state: 'visible', timeout: 15_000 });
  await s.click(link);
  await s.page.waitForLoadState('networkidle').catch(() => {});
}

/** Search the Videos list for part of a title and open that video with its Edit link. */
export async function openVideo(s: Session, search: string, title: string): Promise<void> {
  await s.type(s.page.getByRole('main').getByLabel('Search'), search);
  await s.page.getByText(title).first().waitFor();
  await s.click(
    s.page
      .getByRole('main')
      .getByRole('link', { name: /Edit/ })
      .or(s.page.getByRole('main').getByRole('button', { name: /^Edit/ }))
      .first(),
  );
  await s.page.waitForLoadState('networkidle').catch(() => {});
}

/** Adds a pause after every step that has none, so a short procedure still reads comfortably (content runs need 60 s). */
export function slow<T extends { steps: Array<{ holdMs?: number }> }>(e: T, holdMs: number): T {
  for (const step of e.steps) if (step.holdMs === undefined) step.holdMs = holdMs;
  return e;
}
