import type { Locator } from '@playwright/test';
import type { Episode, EpisodeRole, ShotMark, ShotSpec, Step } from './episode';
import { clickByName, goToScreen, highlight, selectOption, typeInto } from './helpers';
import type { Session } from './session';

/**
 * A small step language for the Money and sponsors path (lane C5). Each line becomes one episode step whose caption is
 * the article step, so the video, the pictures and the article steps stay one to one. Captions keep the screen labels
 * in bold, exactly as the screen words them.
 */

type Target =
  | ['text', string]
  | ['link', string]
  | ['button', string]
  | ['label', string]
  | ['switch', string]
  | ['heading', string];

export interface Pic {
  name: string;
  alt: string;
  marks: Array<[Target, string]>;
}

const locate = (s: Session, t: Target): Locator => {
  const [kind, name] = t;
  switch (kind) {
    case 'text':
      return s.page.getByText(name).first();
    case 'link':
      return s.page.getByRole('link', { name, exact: true }).first();
    case 'button':
      return s.page.getByRole('button', { name, exact: true }).first();
    case 'switch':
      return s.page.getByRole('switch', { name, exact: true }).first();
    case 'label':
      return s.page.getByLabel(name).first();
    case 'heading':
      return s.page.getByRole('heading', { name }).first();
  }
};

const shotOf = (p?: Pic): ShotSpec | undefined =>
  p
    ? {
        name: p.name,
        alt: p.alt,
        marks: p.marks.map(([t, label]): ShotMark => ({ target: (s) => locate(s, t), label })),
      }
    : undefined;

const base = (caption: string, run: Step['run'], p?: Pic, holdMs?: number): Step => ({
  caption,
  run,
  ...(p ? { shot: shotOf(p) } : {}),
  ...(holdMs ? { holdMs } : {}),
});

export const menu = (label: string, heading: string, p?: Pic): Step =>
  base(
    `Choose **${label}** in the side menu.`,
    async (s) => {
      await goToScreen(s, label);
      await s.page.getByRole('heading', { name: heading }).first().waitFor();
    },
    p,
  );

/** Point at text that must be on the screen. `where` finishes the caption, for example "under the title". */
export const see = (text: string, where: string, p?: Pic, note?: string): Step => ({
  ...base(
    `Check that **${text}** ${where}.`,
    async (s) => {
      await highlight(s, s.page.getByText(text).first(), 1600);
    },
    p,
  ),
  ...(note ? { note } : {}),
});

export const link = (name: string, p?: Pic, extra = ''): Step =>
  base(`Click **${name}**${extra}.`, async (s) => {
    await clickByName(s, 'link', name, { exact: true, first: true });
    await s.page.waitForLoadState('networkidle').catch(() => {});
  }, p);

/** `expect` is a label that must appear after the click. A click that lands before the page is ready is repeated once. */
export const button = (name: string, p?: Pic, extra = '', waitMs = 600, expect?: string): Step =>
  base(`Click **${name}**${extra}.`, async (s) => {
    await s.page.waitForLoadState('networkidle').catch(() => {});
    await clickByName(s, 'button', name, { exact: true, first: true });
    if (expect) {
      const seen = await s.page.getByLabel(expect).first().waitFor({ state: 'visible', timeout: 3000 }).then(() => true, () => false);
      if (!seen) await clickByName(s, 'button', name, { exact: true, first: true });
    }
    await s.pause(waitMs);
    await s.page.waitForLoadState('networkidle').catch(() => {});
  }, p);

/** A form that reloads the page (a filter bar). Waits for the new page before anything looks at it. */
export const submit = (name: string, p?: Pic): Step =>
  base(`Click **${name}**.`, async (s) => {
    const target = s.page.getByRole('button', { name, exact: true }).first();
    await s.point(target);
    await s.page.evaluate((r) => window.__kb.highlight(r, 700), (await target.boundingBox())!);
    await s.pause(450);
    await Promise.all([s.page.waitForNavigation({ timeout: 15000, waitUntil: 'load' }).catch(() => {}), target.click()]);
    await s.page.waitForLoadState('networkidle').catch(() => {});
    await s.pause(600);
    await s.guard('after the filter');
  }, p);

export const switchOn = (name: string, p?: Pic): Step =>
  base(`Click **${name}**.`, async (s) => {
    await clickByName(s, 'switch', name, { exact: true });
  }, p);

export const type = (label: string, text: string, p?: Pic): Step =>
  base(`Type "${text}" in the **${label}** box.`, async (s) => {
    await typeInto(s, label, text);
  }, p);

export const choose = (option: string, label: string, p?: Pic): Step =>
  base(`Select **${option}** from the **${label}** list.`, async (s) => {
    await selectOption(s, label, option);
  }, p);

export const tick = (label: string, p?: Pic): Step =>
  base(`Tick **${label}**.`, async (s) => {
    const box = s.page.getByLabel(label, { exact: true }).first();
    await s.click(box);
    if (!(await box.isChecked())) await box.check();
  }, p);

/** A step the checker does not run (needs a file from the person). The recording only points at the control. */
export const file = (label: string, p?: Pic): Step =>
  base(`Choose a file for the **${label}** box.`, async (s) => {
    await highlight(s, s.page.getByLabel(label).first(), 1800);
  }, p);

export const hold = (caption: string, run: (s: Session) => Promise<void>, p?: Pic): Step => base(caption, run, p, 1500);

/** Article only callouts by step number, for example `{ 3: ['TIP', 'Text.'] }`. Never burned into the video. */
export type Notes = Record<number, [kind: 'TIP' | 'CAREFUL' | 'NOTE', text: string]>;

export function money(
  e: Omit<Episode, 'steps' | 'path' | 'viewports'> & { steps: Step[]; notes?: Notes },
): Episode {
  const { notes = {}, steps, ...rest } = e;
  return {
    ...rest,
    path: 'money',
    viewports: ['desktop'],
    steps: steps.map((st, i) => {
      const n = notes[i + 1];
      return n ? { ...st, note: `> [!${n[0]}]\n   > ${n[1]}` } : st;
    }),
  };
}

export type { EpisodeRole };
