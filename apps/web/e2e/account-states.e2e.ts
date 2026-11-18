import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

// Lane R3: Space Grotesk headings (D-162) and the stacked states of S27 to S30 that were never compared with the
// mockups. Fixture build: VIEWER_FIXTURES=on AUTH_FIXTURES=on. The pending deletion test changes the in memory
// fixture account for a moment and cancels it again, so run this file on its own.
const GROTESK = /Space Grotesk/;

async function heading(page: Page, selector: string) {
  return page.locator(selector).first().evaluate((el) => {
    const css = getComputedStyle(el);
    return { family: css.fontFamily, size: css.fontSize, weight: css.fontWeight };
  });
}

test.describe.configure({ mode: 'serial' });

for (const [path, selector] of [
  ['/account', '.acct h1'],
  ['/account/security', '.acct h1'],
  ['/settings/playback', '.acct h1'],
  ['/account/data', '.acct h1'],
  ['/title/counting-money', 'h1'],
] as const) {
  test(`${path} heading is Space Grotesk bold and loads no outside file`, async ({ page }) => {
    const outside: string[] = [];
    page.on('request', (request) => {
      const url = new URL(request.url());
      if (!['localhost', '127.0.0.1'].includes(url.hostname) && url.protocol.startsWith('http'))
        outside.push(request.url());
    });
    await page.goto(path);
    await expect(page.locator(selector).first()).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    const style = await heading(page, selector);
    expect(style.family).toMatch(GROTESK);
    expect(style.weight).toBe('700');
    expect(await page.evaluate(() => document.fonts.check('700 20px "Space Grotesk"'))).toBe(true);
    expect(outside).toEqual([]);
  });
}

test('S27 kids profile sees the adults only card with the 22px heading', async ({ page, context, baseURL }) => {
  await context.addCookies([{ name: 'ad_profile', value: 'prof-3', url: baseURL! }]);
  await page.goto('/account');
  const title = page.getByRole('heading', { name: 'Account is for adults' });
  await expect(title).toBeVisible();
  const style = await title.evaluate((el) => {
    const css = getComputedStyle(el);
    return { family: css.fontFamily, size: css.fontSize };
  });
  expect(style.family).toMatch(GROTESK);
  expect(parseFloat(style.size)).toBeCloseTo(22, 0);
});

test('S28 empty submit shows the field errors', async ({ page }) => {
  await page.goto('/account/security');
  await page.getByRole('button', { name: 'Update password' }).click();
  await expect(page.getByRole('alert').first()).toBeVisible();
  await expect(page.getByText('Enter your current password.')).toBeVisible();
});

test('S29 kids profile shows the parent notice and locks rows', async ({ page, context, baseURL }) => {
  await context.addCookies([{ name: 'ad_profile', value: 'prof-3', url: baseURL! }]);
  await page.goto('/settings/playback');
  await expect(page.getByText('Some settings are managed by a parent account.')).toBeVisible();
  await expect(page.locator('[role="switch"][aria-disabled="true"]').first()).toBeVisible();
});

test('S29 a failed save puts the setting back and offers Retry', async ({ page }) => {
  await page.goto('/settings/playback');
  await page.route('**/settings/playback', async (route) => {
    if (route.request().method() === 'POST') await route.fulfill({ status: 500, body: 'error' });
    else await route.continue();
  });
  const first = page.getByRole('switch').first();
  const before = await first.getAttribute('aria-checked');
  await first.click();
  await expect(page.getByText('We could not save that change. Your setting was put back.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible();
  await expect(first).toHaveAttribute('aria-checked', before ?? 'false');
});

test('S29 a change shows the Saved toast', async ({ page }) => {
  await page.goto('/settings/playback');
  await page.getByRole('switch').first().click();
  await expect(page.getByText('Saved', { exact: true })).toBeVisible();
});

test('S30 pending deletion screen is the only screen, with the soft footer, and can be cancelled', async ({ page }) => {
  await page.goto('/account/data');
  await page.getByRole('button', { name: 'Delete account' }).click();
  const dialog = page.getByRole('dialog', { name: 'Delete your account?' });
  await dialog.getByLabel('Your password').fill('correct-horse-9');
  await dialog.getByLabel('Type DELETE to confirm').fill('DELETE');
  await dialog.getByRole('button', { name: 'Delete my account' }).click();
  await page.goto('/account/deletion');
  const title = page.getByRole('heading', { name: 'Your account is set to close' });
  await expect(title).toBeVisible();
  expect((await heading(page, 'h1, h2')).family).toMatch(GROTESK);
  await expect(page.getByRole('button', { name: 'Cancel deletion' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();
  const link = page.locator('.ad-footer__links a').first();
  await expect(link).toHaveCSS('text-decoration-line', 'none');
  await page.getByRole('button', { name: 'Cancel deletion' }).click();
  await expect(page).toHaveURL(/\/profiles/);
});

test('S28 dialog title is 22px Space Grotesk', async ({ page }) => {
  await page.goto('/account/security');
  await page.getByRole('button', { name: 'Sign out all other devices' }).click();
  const title = page.getByRole('heading', { name: 'Sign out all other devices?' });
  await expect(title).toBeVisible();
  const style = await title.evaluate((el) => {
    const css = getComputedStyle(el);
    return { family: css.fontFamily, size: css.fontSize };
  });
  expect(style.family).toMatch(GROTESK);
  expect(parseFloat(style.size)).toBeCloseTo(22, 0);
});
