/// <reference lib="dom" />
import type { Locator } from '@playwright/test';
import { accountFor, FIXTURE_CODE } from './accounts';
import type { EpisodeRole } from './episode';
import type { Session } from './session';

/**
 * Helpers for episodes. Every one finds controls by role and visible label, never by CSS, so a renamed label fails the
 * run with a clear message. Each helper does one thing a viewer can follow: glide, highlight, click, pause.
 */

/** A menu link keeps its count badge in its name ("Captions1 need attention"), so the plain label also matches. */
export function menuName(label: string): RegExp {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^${escaped}(\\s*\\d+ .*)?$`);
}

const nameOf = (n: string | RegExp) => (typeof n === 'string' ? n : n.source);

/** Click a control by its accessible name. Fails naming the role and label when it is missing. */
export async function clickByName(
  s: Session,
  role: 'button' | 'link' | 'tab' | 'checkbox' | 'menuitem' | 'radio' | 'switch',
  name: string | RegExp,
  o: { exact?: boolean; first?: boolean } = {},
): Promise<void> {
  const loc = s.page.getByRole(role, { name, exact: o.exact });
  const target = o.first ? loc.first() : loc;
  await expectFound(target, `${role} "${nameOf(name)}"`);
  await s.click(target);
}

/** Type into a field found by its label. */
export async function typeInto(s: Session, label: string | RegExp, text: string): Promise<void> {
  const field = s.page.getByLabel(label);
  await expectFound(field, `field "${nameOf(label)}"`);
  await s.type(field, text);
}

/** Choose an option of a native select found by its label. */
export async function selectOption(
  s: Session,
  label: string | RegExp,
  option: string,
): Promise<void> {
  const field = s.page.getByLabel(label);
  await expectFound(field, `select "${nameOf(label)}"`);
  await s.click(field);
  await field.selectOption({ label: option });
  await s.pause(400);
}

/** Wait for a status message (toast or live region) with this text. */
export async function waitForToast(
  s: Session,
  text: string | RegExp,
  timeoutMs = 8000,
): Promise<void> {
  const toast = s.page.getByRole('status').filter({ hasText: text }).first();
  try {
    await toast.waitFor({ state: 'visible', timeout: timeoutMs });
  } catch {
    throw new Error(`No message saying "${nameOf(text)}" appeared within ${timeoutMs} ms`);
  }
  await s.pause(500);
}

/** Smoothly scroll until the target is on screen and clear of the caption. */
export async function scrollTo(s: Session, target: Locator, anchor = 0.3): Promise<void> {
  await expectFound(target, 'the scroll target');
  await s.reveal(target, anchor);
}

/** Point at something without clicking and draw the amber box around it. */
export async function highlight(s: Session, target: Locator, holdMs = 1200): Promise<void> {
  await expectFound(target, 'the highlight target');
  await s.point(target);
  const box = await target.boundingBox();
  if (box)
    await s.page.evaluate(([r, ms]) => window.__kb.highlight(r, ms), [
      box,
      holdMs * s.paceFactor,
    ] as const);
  await s.pause(holdMs);
}

/** Zoom in on a target to show small text, then zoom back out. Do not click while zoomed. */
export async function zoom(s: Session, target: Locator, scale = 1.6, holdMs = 1800): Promise<void> {
  await expectFound(target, 'the zoom target');
  await s.reveal(target);
  const box = await target.boundingBox();
  if (!box) throw new Error('The zoom target has no box');
  await s.page.evaluate(([r, sc, ms]) => window.__kb.zoom(r, sc, ms), [
    box,
    scale,
    700 * s.paceFactor,
  ] as const);
  await s.pause(holdMs);
  await s.page.evaluate((ms) => window.__kb.zoom(null, 1, ms), 700 * s.paceFactor);
  await s.pause(200);
}

/** Open a screen from the side menu (opens the menu first on a phone). */
export async function goToScreen(s: Session, label: string): Promise<void> {
  if (s.profile.mobile) {
    const open = s.page.getByRole('button', { name: 'Open menu' });
    if (await open.isVisible().catch(() => false)) await s.click(open);
  }
  const link = s.page.getByRole('link', { name: menuName(label) }).first();
  await expectFound(link, `menu item "${label}"`);
  await s.click(link);
  await s.page.waitForLoadState('networkidle').catch(() => {});
}

/**
 * Sign in as a demo role through the real sign in screens: email, password, then the six digit code. Fixture mode
 * shows and accepts 123456. A real services stack takes the code from KB_2FA_CODE.
 */
export async function signInAs(
  s: Session,
  role: EpisodeRole,
  o: { slow?: boolean } = {},
): Promise<void> {
  if (role === 'none') return;
  const account = accountFor(role);
  const code = process.env.KB_2FA_CODE ?? FIXTURE_CODE;
  await s.goto('/admin/login');
  if (o.slow) {
    await s.type(s.page.getByLabel('Email'), account.email);
    await s.type(s.page.getByLabel('Password'), account.password);
  } else {
    await s.page.getByLabel('Email').fill(account.email);
    await s.page.getByLabel('Password').fill(account.password);
  }
  await s.page.getByRole('button', { name: 'Sign in' }).click();
  await s.page.getByLabel('Digit 1 of 6').click();
  await s.page.keyboard.type(code, { delay: o.slow ? 120 : 10 });
  await s.page.getByRole('button', { name: 'Verify' }).click();
  await s.page.getByRole('heading', { name: 'Dashboard' }).waitFor();
}

async function expectFound(target: Locator, what: string): Promise<void> {
  try {
    await target.first().waitFor({ state: 'visible', timeout: 10_000 });
  } catch {
    const near = await nearLabels(target).catch(() => []);
    throw new Error(
      `Could not find ${what} on ${target.page().url()}.` +
        (near.length ? ` Labels on the screen: ${near.slice(0, 12).join(', ')}` : ''),
    );
  }
}

/** Visible button, link and tab names, so a failure shows what the screen says now. */
async function nearLabels(target: Locator): Promise<string[]> {
  return target.page().evaluate(() => {
    const out = new Set<string>();
    for (const el of Array.from(
      document.querySelectorAll('button, a, [role=tab], [role=menuitem]'),
    )) {
      const t = (el.getAttribute('aria-label') || el.textContent || '').trim().replace(/\s+/g, ' ');
      if (t && t.length < 40) out.add(t);
    }
    return [...out];
  });
}
