import { chromium, type Browser } from '@playwright/test';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { runSteps } from './fact-run';
import { overlayInitScript } from './overlay';
import { PROFILES } from './profiles';
import { Session } from './session';

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

const HTML = `
<nav><a href="#videos" id="l1">Videos</a> <a href="#upload">Upload</a></nav>
<h1>Videos</h1>
<label>Title <input id="t"></label>
<label><input type="checkbox" id="c"> Compact rows</label>
<label>Status <select id="s"><option>All</option><option>Published</option></select></label>
<button id="b" onclick="document.getElementById('o').textContent='Saved'">Save</button>
<p id="o"></p>
<h2>Home preview clip</h2>`;

async function session() {
  const context = await browser!.newContext({
    viewport: { width: 1280, height: 720 },
    bypassCSP: true,
  });
  await context.addInitScript({ content: overlayInitScript({ touch: false }) });
  const page = await context.newPage();
  await page.setContent(HTML);
  return { context, s: new Session(page, PROFILES.desktop, null, 0.1) };
}

describe('runSteps (needs Chromium)', () => {
  it('runs a followable article to the end', async (ctx) => {
    if (!browser) return ctx.skip();
    const { context, s } = await session();
    const steps = [
      { n: 1, text: 'Choose **Videos** in the side menu.' },
      { n: 2, text: 'Type "Rivers" in the **Title** box.' },
      { n: 3, text: 'Tick **Compact rows**.' },
      { n: 4, text: 'Select **Published** from the **Status** list.' },
      { n: 5, text: 'Click **Save**.' },
      { n: 6, text: 'Wait until you see **Saved**.' },
      { n: 7, text: 'Scroll to **Home preview clip**.' },
      { n: 8, text: 'Drag your video onto the box.' },
    ];
    const r = await runSteps(s, steps);
    expect(r.failure?.reason).toBeUndefined();
    expect(r.results.map((x) => x.status)).toEqual([
      'ok',
      'ok',
      'ok',
      'ok',
      'ok',
      'ok',
      'ok',
      'manual',
    ]);
    expect(await s.page.inputValue('#t')).toBe('Rivers');
    expect(await s.page.isChecked('#c')).toBe(true);
    await context.close();
  }, 60_000);

  it('types the demo account of the role for your email, so no sign in detail is written in an article', async (ctx) => {
    if (!browser) return ctx.skip();
    const { context, s } = await session();
    const r = await runSteps(s, [{ n: 1, text: 'Type your email in the **Title** box.' }], {
      role: 'editor',
    });
    expect(r.failure).toBeNull();
    expect(await s.page.getByLabel('Title').inputValue()).toBe('ngozi@example.test');
    await context.close();
  });

  it('stops at the first step that fails and names it with the labels on screen', async (ctx) => {
    if (!browser) return ctx.skip();
    const { context, s } = await session();
    const r = await runSteps(s, [
      { n: 1, text: 'Click **Save**.' },
      { n: 2, text: 'Click **Publish now**.' },
      { n: 3, text: 'Click **Save**.' },
    ]);
    expect(r.failure).toMatchObject({ n: 2, text: 'Click **Publish now**.' });
    expect(r.failure!.reason).toMatch(/Publish now/);
    expect(r.failure!.reason).toMatch(/Save/);
    expect(r.results).toHaveLength(1);
    await context.close();
  }, 60_000);

  it('fails a step that cannot be followed without touching the page', async (ctx) => {
    if (!browser) return ctx.skip();
    const { context, s } = await session();
    const r = await runSteps(s, [{ n: 1, text: 'Open the menu and pick something.' }]);
    expect(r.failure).toMatchObject({ n: 1 });
    expect(r.failure!.reason).toMatch(/bold/);
    await context.close();
  }, 60_000);

  it('fails when text it should see never appears', async (ctx) => {
    if (!browser) return ctx.skip();
    const { context, s } = await session();
    const r = await runSteps(s, [{ n: 1, text: 'Wait until you see **Uploaded**.' }], {
      seeTimeoutMs: 800,
    });
    expect(r.failure!.reason).toMatch(/Uploaded/);
    await context.close();
  }, 60_000);
});
