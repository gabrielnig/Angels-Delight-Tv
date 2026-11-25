import { chromium, type Browser } from '@playwright/test';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
// Built at run time so no source line looks like a real key to secret scanners.
const SK = ['sk', 'live', '4eC39HqLyjWDarjtT1zdp7dc'].join('_');
import { assertPageClean, CaptureRefused, pageText } from './scan-page';

let browser: Browser | null = null;
beforeAll(async () => {
  try {
    browser = await chromium.launch({ executablePath: process.env.E2E_CHROMIUM_PATH });
  } catch {
    browser = null;
  }
});
afterAll(async () => {
  await browser?.close();
});

const page = async (html: string) => {
  const p = await browser!.newPage();
  await p.setContent(html);
  return p;
};

describe('page scan (needs Chromium)', () => {
  it('reads visible text, field values and alt text but not passwords or hidden text', async (ctx) => {
    if (!browser) return ctx.skip();
    const p = await page(
      '<p>Hello</p><p style="display:none">secret hidden</p><input value="typed@example.test"><input type="password" value="hunter2hunter2"><img alt="A chart" src="data:image/gif;base64,R0lGODlhAQABAAAAACw=">',
    );
    const text = await pageText(p);
    expect(text).toContain('Hello');
    expect(text).toContain('typed@example.test');
    expect(text).toContain('A chart');
    expect(text).not.toContain('hunter2');
    expect(text).not.toContain('secret hidden');
    await p.close();
  });

  it('passes a clean page', async (ctx) => {
    if (!browser) return ctx.skip();
    const p = await page('<h1>Videos</h1><p>Contact demo@example.com</p>');
    await expect(assertPageClean(p, 'step 1')).resolves.toBeUndefined();
    await p.close();
  });

  it('refuses a page with a real looking email and a key, and names where', async (ctx) => {
    if (!browser) return ctx.skip();
    const p = await page(`<p>ceo@realcompany.com</p><input value="${SK}">`);
    const err = await assertPageClean(p, 'step 4').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(CaptureRefused);
    expect((err as CaptureRefused).message).toMatch(/step 4/);
    expect((err as CaptureRefused).findings.map((f) => f.kind).sort()).toEqual(['email', 'secret']);
    expect((err as Error).message).not.toContain(SK.slice(8));
    await p.close();
  });
});
