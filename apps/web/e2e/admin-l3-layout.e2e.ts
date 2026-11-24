import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

// L3: punch list and bulk screens at 360, 390, 768, 1360 and 200 percent zoom of 1360 (680 wide).
// Fixture build sign in, see admin-upload.e2e.ts.
async function signIn(page: Page) {
  await page.goto('/admin/login');
  await page.getByLabel('Email').fill('chiamaka@example.test');
  await page.getByLabel('Password').fill('fixture-password');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByLabel('Digit 1 of 6').click();
  await page.keyboard.type('123456');
  await page.getByRole('button', { name: 'Verify' }).click();
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
}

const SCREENS = [
  '/admin/videos',
  '/admin/encoding',
  '/admin/captions',
  '/admin/videos/trash',
  '/admin/series',
  '/admin/users',
  '/admin/roles',
  '/admin/videos/upload',
  '/admin/audit-log',
];
const WIDTHS = [360, 390, 768, 680, 1360];

for (const width of WIDTHS) {
  test(`admin screens at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await signIn(page);
    const problems: string[] = [];
    for (const path of SCREENS) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      // Tick the first visible row checkbox so the bulk bar shows.
      const row = page.locator('input[type="checkbox"]:visible').first();
      if (await row.count()) await row.check({ force: true }).catch(() => {});
      const report = await page.evaluate(() => {
        const out: string[] = [];
        const de = document.documentElement;
        if (de.scrollWidth > window.innerWidth + 1)
          out.push(`page scrolls sideways (${de.scrollWidth} > ${window.innerWidth})`);
        const vis = (el: Element) => (el as HTMLElement).offsetParent !== null;
        const small = (sel: string, name: string) => {
          for (const el of Array.from(document.querySelectorAll(sel)).filter(vis)) {
            const r = el.getBoundingClientRect();
            if (r.width < 43.5 || r.height < 43.5)
              out.push(`${name} "${(el.textContent ?? '').trim().slice(0, 24)}" ${Math.round(r.width)}x${Math.round(r.height)}`);
          }
        };
        small('.adm-bulk .adm-btn, .adm-bulk__all, .adm-bulk__menuitem', 'bulk control');
        small('main .adm-check', 'checkbox');
        small('nav[aria-label*="readcrumb" i] a', 'crumb');
        const crumb = document.querySelector('nav[aria-label*="readcrumb" i]');
        if (crumb) {
          const r = crumb.getBoundingClientRect();
          if (r.right > window.innerWidth + 1) out.push('breadcrumb overflows');
        }
        return out;
      });
      for (const line of report) problems.push(`${path}: ${line}`);
      await page.screenshot({ path: `/tmp/l3-shots/${width}${path.replaceAll('/', '_')}.png` });
    }
    expect(problems, problems.join('\n')).toEqual([]);
  });
}
