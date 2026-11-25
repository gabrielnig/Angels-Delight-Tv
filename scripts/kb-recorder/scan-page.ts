/// <reference lib="dom" />
import type { Page } from '@playwright/test';
import { formatFindings, scanText, type Finding } from './scan';

export class CaptureRefused extends Error {
  constructor(
    readonly where: string,
    readonly findings: Finding[],
  ) {
    super(formatFindings(where, findings));
  }
}

/** Everything a viewer of the recording could read: visible text, field values (not passwords), placeholders, alt and titles. */
export async function pageText(page: Page): Promise<string> {
  return page.evaluate(() => {
    const parts: string[] = [document.body.innerText];
    for (const el of Array.from(document.querySelectorAll('input, textarea, select'))) {
      const input = el as HTMLInputElement;
      if (input.type === 'password' || input.type === 'hidden') continue;
      if (input.value) parts.push(input.value);
      if (input.placeholder) parts.push(input.placeholder);
    }
    for (const el of Array.from(document.querySelectorAll('[alt], [title], [aria-label]'))) {
      for (const a of ['alt', 'title', 'aria-label']) {
        const v = el.getAttribute(a);
        if (v) parts.push(v);
      }
    }
    return parts.join('\n');
  });
}

/** Reads the page text, trying again when a navigation destroys the page mid read (a redirect, a dev server reload). */
async function readStable(page: Page): Promise<string> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await pageText(page);
    } catch (e) {
      const navigating = e instanceof Error && /context was destroyed|navigation|reading .innerText./i.test(e.message);
      if (!navigating || attempt >= 4) throw e;
      await page.waitForLoadState('load').catch(() => {});
    }
  }
}

/** Throws CaptureRefused when the page shows real looking data. Run after every step and before every screenshot. */
export async function assertPageClean(
  page: Page,
  where: string,
  o: { allow?: string[] } = {},
): Promise<void> {
  const findings = scanText(await readStable(page), o);
  if (findings.length > 0) throw new CaptureRefused(where, findings);
}
