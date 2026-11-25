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

/** Throws CaptureRefused when the page shows real looking data. Run after every step and before every screenshot. */
export async function assertPageClean(
  page: Page,
  where: string,
  o: { allow?: string[] } = {},
): Promise<void> {
  const findings = scanText(await pageText(page), o);
  if (findings.length > 0) throw new CaptureRefused(where, findings);
}
