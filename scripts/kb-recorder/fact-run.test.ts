import { chromium, type Browser } from '@playwright/test';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { fileNameHint, runSteps } from './fact-run';
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
<nav><a href="#videos" id="l1">Videos</a> <a href="#upload">Upload</a> <a href="#cap" id="cap">Captions<span>1 need attention</span></a></nav>
<h1>Videos</h1>
<label>Title <input id="t"></label>
<label>Count <input id="n" value="10"></label>
<label><input type="checkbox" id="c"> Compact rows</label>
<label>Status <select id="s"><option>All</option><option>Published</option></select></label>
<button id="b" onclick="document.getElementById('o').textContent='Saved'">Save</button>
<p id="o"></p>
<h2>Home preview clip</h2>
<div style="width:200px;overflow-x:auto;white-space:nowrap" id="strip"><button style="margin-right:400px">First tab</button><button id="far" onclick="document.getElementById('o').textContent='Far clicked'">Far tab</button></div>
<details><summary><span class="sr">Account menu for </span><span aria-hidden="true">DE</span> Demo Editor</summary><a href="#me">My account</a></details>
<p hidden>Video is live somewhere hidden</p>
<p id="live" hidden>Maths is live.</p>
<button id="go" onclick="document.getElementById('live').hidden=false">Go</button>`;

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

describe('fileNameHint', () => {
  it('takes the file name a following choose a file step asks for', () => {
    expect(fileNameHint('Choose a file from your computer, named "flaky-lesson.mp4".')).toBe(
      'flaky-lesson.mp4',
    );
    expect(fileNameHint('Choose a file from your computer.')).toBeUndefined();
    expect(fileNameHint('Click **Retry**.')).toBeUndefined();
    expect(fileNameHint(undefined)).toBeUndefined();
  });
});

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

  it('clicks a control that sits out of view in a sideways scrolling strip', async (ctx) => {
    if (!browser) return ctx.skip();
    const { context, s } = await session();
    const r = await runSteps(s, [
      { n: 1, text: 'Click **Far tab**.' },
      { n: 2, text: 'Wait until you see **Far clicked**.' },
    ]);
    expect(r.failure).toBeNull();
    await context.close();
  }, 60_000);

  it('replaces the text that is already in a box when a step says Type', async (ctx) => {
    if (!browser) return ctx.skip();
    const { context, s } = await session();
    const r = await runSteps(s, [{ n: 1, text: 'Type "20" in the **Count** box.' }]);
    expect(r.failure).toBeNull();
    expect(await s.page.inputValue('#n')).toBe('20');
    await context.close();
  }, 60_000);

  it('finds a menu item that carries a count badge by its plain label', async (ctx) => {
    if (!browser) return ctx.skip();
    const { context, s } = await session();
    const r = await runSteps(s, [{ n: 1, text: 'Click **Captions** in the side menu.' }]);
    expect(r.failure).toBeNull();
    expect(s.page.url()).toContain('#cap');
    await context.close();
  }, 60_000);

  it('opens a menu built from a details summary by its name', async (ctx) => {
    if (!browser) return ctx.skip();
    const { context, s } = await session();
    const r = await runSteps(s, [
      { n: 1, text: 'Click **Account menu for Demo Editor**.' },
      { n: 2, text: 'Click **My account**.' },
    ]);
    expect(r.failure).toBeNull();
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

  it('gives a demo video to a file chooser that a Choose button opens, like a person picking a file', async (ctx) => {
    if (!browser) return ctx.skip();
    const { context, s } = await session();
    await s.page.setContent(
      `<button onclick="document.getElementById('f').click()">Choose videos</button>
       <input id="f" type="file" hidden accept=".mp4,.mov" onchange="document.getElementById('o').textContent=this.files[0].name+':'+this.files[0].type">
       <p id="o"></p>`,
    );
    const r = await runSteps(s, [
      { n: 1, text: 'Click **Choose videos**.' },
      { n: 2, text: 'Wait until you see **demo-lesson.mp4**.' },
    ]);
    expect(r.failure).toBeNull();
    await context.close();
  });

  it('finds a choice by the label it starts with, since its help line is part of the name', async (ctx) => {
    if (!browser) return ctx.skip();
    const { context, s } = await session();
    await s.page.setContent(
      `<label><input type="radio" name="w" id="r1"><span><strong>Publish now</strong> Viewers can watch it.</span></label>
       <label><input type="radio" name="w" id="r2" onchange="document.getElementById('o').textContent='Picked'"><span><strong>Schedule</strong> Pick a date and time.</span></label>
       <p id="o"></p>`,
    );
    const r = await runSteps(s, [
      { n: 1, text: 'Click **Schedule**.' },
      { n: 2, text: 'Wait until you see **Picked**.' },
    ]);
    expect(r.failure).toBeNull();
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

  it('opens a details menu by the label of its summary and waits for text past a hidden copy', async (ctx) => {
    if (!browser) return ctx.skip();
    const { context, s } = await session();
    const r = await runSteps(s, [
      { n: 1, text: 'Click **Account menu for Demo Editor**.' },
      { n: 2, text: 'Click **Go**.' },
      { n: 3, text: 'Wait until you see **is live**.' },
    ]);
    expect(r.failure).toBeNull();
    expect(await s.page.getByRole('link', { name: 'My account' }).isVisible()).toBe(true);
    await context.close();
  }, 60_000);
});
