import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium, type Browser, type Page } from '@playwright/test';

const root = resolve(import.meta.dirname, '../../../..');

/** A Chromium to measure real layout with. Set PW_CHROMIUM to choose one. Null when none is installed. */
export function findChromium(): string | null {
  const candidates = [
    process.env.PW_CHROMIUM,
    '/tmp/pwb/chromium-1255/chrome-linux64/chrome',
    '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ];
  return candidates.find((p): p is string => Boolean(p) && existsSync(p as string)) ?? null;
}

/** The stylesheets a Browse page uses, in cascade order, read from source. */
export function pageCss(extra: string[] = []): string {
  const files = [
    'packages/ui/src/tokens.css',
    'packages/ui/src/components.css',
    'apps/web/src/app/globals.css',
    ...extra,
  ];
  return files.map((f) => readFileSync(resolve(root, f), 'utf8')).join('\n');
}

export async function launch(): Promise<Browser> {
  const executablePath = findChromium();
  if (!executablePath) throw new Error('no Chromium found');
  return chromium.launch({ executablePath });
}

/** Opens a page at a width with the given body markup and stylesheet text. */
export async function openAt(
  browser: Browser,
  width: number,
  body: string,
  css: string,
  height = 800,
): Promise<Page> {
  const page = await browser.newPage({ viewport: { width, height } });
  await page.setContent(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body>${body}</body></html>`,
  );
  return page;
}
