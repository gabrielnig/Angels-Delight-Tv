/// <reference lib="dom" />
import type { Locator } from '@playwright/test';
import { interpretStep, type Action } from './fact-check';
import { accountFor, FIXTURE_CODE } from './accounts';
import type { EpisodeRole } from './episode';
import { goToScreen, menuName } from './helpers';
import type { Session } from './session';

export interface StepResult {
  n: number;
  text: string;
  status: 'ok' | 'manual';
}

export interface StepFailureReport {
  n: number;
  text: string;
  reason: string;
}

const ROLES = ['button', 'link', 'tab', 'menuitem', 'checkbox', 'radio', 'switch'] as const;

/** Any control with this exact accessible name. A label quoted in an article must match the screen exactly. */
function control(s: Session, label: string): Locator {
  let loc = s.page.getByRole(ROLES[0], { name: label, exact: true });
  for (const role of ROLES.slice(1))
    loc = loc.or(s.page.getByRole(role, { name: label, exact: true }));
  // A menu made from a details summary has no button role in every browser, so it is found by its text.
  loc = loc.or(s.page.locator('summary').filter({ hasText: label }));
  return loc.first();
}


async function labelsOnScreen(s: Session): Promise<string[]> {
  return s.page
    .evaluate(() => {
      const out = new Set<string>();
      for (const el of Array.from(
        document.querySelectorAll('button, a, [role=tab], [role=menuitem], label, h1, h2'),
      )) {
        const t = (el.getAttribute('aria-label') || el.textContent || '')
          .trim()
          .replace(/\s+/g, ' ');
        if (t && t.length < 40) out.add(t);
      }
      return [...out];
    })
    .catch(() => []);
}

async function visible(loc: Locator, ms: number): Promise<boolean> {
  try {
    await loc.waitFor({ state: 'visible', timeout: ms });
    return true;
  } catch {
    return false;
  }
}

async function execute(
  s: Session,
  a: Action,
  seeTimeoutMs: number,
  role: EpisodeRole,
): Promise<string | null> {
  const find = async (what: string, loc: Locator) =>
    (await visible(loc, 6000)) ? null : `Cannot find ${what} on ${new URL(s.page.url()).pathname}.`;
  switch (a.kind) {
    case 'menu': {
      const link = s.page.getByRole('link', { name: menuName(a.label) }).first();
      const open = s.page.getByRole('button', { name: 'Open menu' });
      if (s.profile.mobile && (await open.isVisible().catch(() => false))) await s.click(open);
      const miss = await find(`the menu item "${a.label}"`, link);
      if (miss) return miss;
      await s.click(link);
      break;
    }
    case 'click': {
      const loc = control(s, a.label);
      const miss = await find(`a control named "${a.label}"`, loc);
      if (miss) return miss;
      await loc.scrollIntoViewIfNeeded().catch(() => {});
      await s.click(loc);
      // A person waits for a save to finish before the next move, so the page gets a moment to settle.
      await s.page.waitForLoadState('networkidle', { timeout: 3000 }).catch(() => {});
      await s.page.waitForTimeout(600);
      break;
    }
    case 'type': {
      const loc = s.page.getByLabel(a.label, { exact: true }).first();
      const miss = await find(`a field labelled "${a.label}"`, loc);
      if (miss) return miss;
      if (a.secret === 'code') {
        // The six digit boxes move on by themselves, so the digits are typed after the first box has focus.
        await s.click(loc);
        await s.page.keyboard.type(process.env.KB_2FA_CODE ?? FIXTURE_CODE, { delay: 20 });
      } else if (a.secret) {
        await s.type(loc, accountFor(role)[a.secret], 20);
      } else {
        // Typing replaces what is in the box, as a person would after selecting it.
        await s.click(loc);
        await loc.press('Control+A');
        await loc.press('Backspace');
        await s.type(loc, a.text, 20);
      }
      break;
    }
    case 'goto': {
      await s.goto(a.path);
      break;
    }
    case 'check': {
      const loc = s.page.getByLabel(a.label, { exact: true }).first();
      const miss = await find(`a box labelled "${a.label}"`, loc);
      if (miss) return miss;
      await s.reveal(loc);
      await loc.setChecked(a.on);
      break;
    }
    case 'select': {
      const loc = s.page
        .getByRole('combobox', { name: a.label, exact: true })
        .or(s.page.getByLabel(a.label, { exact: true }))
        .first();
      const miss = await find(`a list labelled "${a.label}"`, loc);
      if (miss) return miss;
      try {
        await loc.selectOption({ label: a.option }, { timeout: 4000 });
      } catch {
        return `The list "${a.label}" has no option "${a.option}".`;
      }
      break;
    }
    case 'see': {
      if (!(await visible(s.page.getByText(a.text, { exact: false }).first(), seeTimeoutMs))) {
        return `The text "${a.text}" never appeared on ${new URL(s.page.url()).pathname}.`;
      }
      break;
    }
    case 'scroll': {
      const loc = s.page.getByText(a.text, { exact: false }).first();
      const miss = await find(`the text "${a.text}"`, loc);
      if (miss) return miss;
      await s.reveal(loc);
      break;
    }
    case 'manual':
    case 'unclear':
      break;
  }
  await s.page.waitForLoadState('networkidle').catch(() => {});
  return null;
}

/**
 * Follows the steps of an article in order on the page of the session, using only their text. Stops at the first step
 * that cannot be followed or whose control or text is not on the screen, and says which and what the screen shows.
 */
export async function runSteps(
  s: Session,
  steps: Array<{ n: number; text: string }>,
  o: { seeTimeoutMs?: number; role?: EpisodeRole } = {},
): Promise<{ results: StepResult[]; failure: StepFailureReport | null }> {
  const results: StepResult[] = [];
  for (const step of steps) {
    const action = interpretStep(step.text);
    if (action.kind === 'unclear') {
      return { results, failure: { n: step.n, text: step.text, reason: action.reason } };
    }
    if (action.kind === 'manual') {
      results.push({ n: step.n, text: step.text, status: 'manual' });
      continue;
    }
    let problem: string | null;
    try {
      problem = await execute(s, action, o.seeTimeoutMs ?? 10_000, o.role ?? 'editor');
      if (!problem) await s.guard(`step ${step.n}`);
    } catch (e) {
      problem = e instanceof Error ? e.message.split('\n')[0]! : String(e);
    }
    if (problem) {
      const labels = (await labelsOnScreen(s)).slice(0, 14);
      return {
        results,
        failure: {
          n: step.n,
          text: step.text,
          reason: `${problem}${labels.length ? ` The screen shows: ${labels.join(', ')}.` : ''}`,
        },
      };
    }
    results.push({ n: step.n, text: step.text, status: 'ok' });
  }
  return { results, failure: null };
}

export { goToScreen };
