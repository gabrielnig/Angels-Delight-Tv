import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

// M50-S11 and S12: the help centre at 360, 600, 960 and 1280. No sideways scroll, 44 px targets, axe with no
// serious or critical issue, the Help panel as a bottom sheet below 960 and a drawer from 960, and the offline note.
// Fixture build sign in, see admin-upload.e2e.ts.
async function signIn(page: Page) {
  await page.goto('/admin/login');
  await page.getByLabel('Email').fill('arkdev@example.test');
  await page.getByLabel('Password').fill('fixture-password');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByLabel('Digit 1 of 6').click();
  await page.keyboard.type('123456');
  await page.getByRole('button', { name: 'Verify' }).click();
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
}

const WIDTHS = [360, 600, 960, 1280];
const PAGES = [
  '/admin/help',
  '/admin/help/path/daily',
  '/admin/help/D02',
  '/admin/help/search?q=upload',
  '/admin/help/glossary',
];

async function layoutProblems(page: Page, scope: string): Promise<string[]> {
  return page.evaluate((root) => {
    const out: string[] = [];
    const de = document.documentElement;
    if (de.scrollWidth > window.innerWidth + 1)
      out.push(`page scrolls sideways (${de.scrollWidth} > ${window.innerWidth})`);
    const area = document.querySelector(root) ?? document.body;
    const visible = (el: Element) => {
      const r = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && style.visibility !== 'hidden';
    };
    for (const el of Array.from(
      area.querySelectorAll('button, [role="button"], summary, select, input:not([type="hidden"])'),
    ).filter(visible)) {
      const r = el.getBoundingClientRect();
      if (r.height < 43.5 || r.width < 43.5) {
        const label = (el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 24);
        out.push(`target "${label}" ${Math.round(r.width)}x${Math.round(r.height)}`);
      }
    }
    for (const el of Array.from(area.querySelectorAll('img, video')).filter(visible)) {
      if (el.getBoundingClientRect().right > window.innerWidth + 1)
        out.push(`${el.tagName} overflows`);
    }
    return out;
  }, scope);
}

async function axe(page: Page, where: string) {
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  const bad = result.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map(
      (v) =>
        `${v.id} (${v.impact}): ${v.nodes
          .map((n) => n.target.join(' '))
          .slice(0, 3)
          .join(' | ')}`,
    );
  expect(bad, `axe on ${where}`).toEqual([]);
}

for (const width of WIDTHS) {
  test(`help pages at ${width}`, async ({ page }) => {
    test.setTimeout(150_000);
    await page.setViewportSize({ width, height: 800 });
    await signIn(page);
    for (const path of PAGES) {
      await page.goto(path, { waitUntil: 'networkidle' });
      expect(await layoutProblems(page, '#adm-main'), `layout on ${path}`).toEqual([]);
      await axe(page, `${path} at ${width}`);
    }
  });

  test(`help panel at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await signIn(page);
    await page.goto('/admin/videos/upload', { waitUntil: 'networkidle' });
    const help = page.getByRole('banner').getByRole('link', { name: 'Help' });
    await help.focus();
    await page.keyboard.press('Enter');
    const panel = page.getByRole('dialog', { name: 'Help for this screen' });
    await expect(panel).toBeVisible();
    // Reduced motion: nothing slides in, so the box is final the moment it shows.
    expect(await panel.evaluate((el) => getComputedStyle(el).animationName)).toBe('none');
    const box = (await panel.boundingBox())!;
    if (width >= 960) {
      // Drawer: on the right edge, the page behind stays usable.
      expect(Math.round(box.x + box.width)).toBe(width);
      expect(box.width).toBeLessThanOrEqual(width * 0.4 + 1);
    } else {
      // Sheet: along the bottom edge, full width.
      expect(Math.round(box.width)).toBe(width);
      expect(Math.round(box.y + box.height)).toBe(800);
    }
    expect(await layoutProblems(page, '[role="dialog"]'), 'panel layout').toEqual([]);
    await axe(page, `panel at ${width}`);
    // Tab stays inside, Escape closes and focus returns to Help.
    for (let i = 0; i < 8; i += 1) {
      await page.keyboard.press('Tab');
      expect(await panel.evaluate((el) => el.contains(document.activeElement))).toBe(true);
    }
    await page.keyboard.press('Escape');
    await expect(panel).toBeHidden();
    await expect(help).toBeFocused();
  });

  test(`offline note at ${width}`, async ({ page, context }) => {
    await page.setViewportSize({ width, height: 800 });
    await signIn(page);
    await page.goto('/admin/help/D02', { waitUntil: 'networkidle' });
    await context.setOffline(true);
    await expect(
      page.getByRole('status').filter({ hasText: 'You are offline' }).first(),
    ).toBeVisible();
    expect(await layoutProblems(page, '#adm-main'), 'offline layout').toEqual([]);
    await context.setOffline(false);
  });
}

// M50-S09: the print copy. Chrome and the player are hidden, steps and pictures are not cut, type is at least 11 pt,
// links to other guides print their id, and the id and release line is there.
test('print layout of a guide', async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 794, height: 1123 });
  await signIn(page);
  for (const id of ['S04', 'D02']) {
    await page.goto(`/admin/help/${id}`, { waitUntil: 'networkidle' });
    await page.emulateMedia({ media: 'print' });
    const report = await page.evaluate(() => {
      const out: string[] = [];
      const shown = (sel: string) =>
        Array.from(document.querySelectorAll(sel)).filter(
          (el) => getComputedStyle(el).display !== 'none',
        );
      for (const sel of [
        '.adm-side',
        '.adm-top',
        '.hlp-video',
        '.hlp-toc',
        '.hlp-prevnext',
        '.hlp-actions',
        '.adm-pagehead__actions',
      ]) {
        if (shown(sel).length) out.push(`${sel} still shows in print`);
      }
      const de = document.documentElement;
      if (de.scrollWidth > window.innerWidth + 1)
        out.push(`print copy is wider than the page (${de.scrollWidth})`);
      const body = document.querySelector('.hlp-body');
      if (body && parseFloat(getComputedStyle(body).fontSize) < 14.6)
        out.push('body type under 11 pt');
      for (const li of Array.from(document.querySelectorAll('.hlp-steps > li'))) {
        if (getComputedStyle(li).breakInside !== 'avoid') out.push('a step can be cut');
      }
      for (const fig of Array.from(document.querySelectorAll('.hlp-figure'))) {
        if (getComputedStyle(fig).breakInside !== 'avoid') out.push('a picture can be cut');
        const img = fig.querySelector('img');
        const ir = img?.getBoundingClientRect();
        const fr = fig.getBoundingClientRect();
        if (ir && Math.abs(ir.width - fr.width) > 2) out.push('a picture does not fill its frame');
        if (ir && body && ir.right > body.getBoundingClientRect().right + 1)
          out.push('a picture runs past the page text');
        if (img && !img.getAttribute('alt')) out.push('a picture has no alt text');
      }
      for (const a of Array.from(document.querySelectorAll('.hlp-body a[data-guide]'))) {
        const after = getComputedStyle(a, '::after').content;
        if (!after.includes(`guide ${a.getAttribute('data-guide')}`))
          out.push('a guide link does not print its id');
      }
      const stamp = document.querySelector('.hlp-stamp');
      if (!stamp || getComputedStyle(stamp).display === 'none') out.push('no id and release line');
      return out;
    });
    expect(report, `print layout of ${id}`).toEqual([]);
    await expect(page.locator('.hlp-stamp')).toContainText(`guide ${id}`);
    const pdf = await page.pdf({ format: 'A4', printBackground: true });
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    await page.emulateMedia({ media: 'screen' });
  }
});
