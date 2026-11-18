import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

// Lane P3: the account screens (S27 to S30) and the site pages (S31) keep the 44px tap rule and pass axe.
// Fixture build: VIEWER_FIXTURES=on AUTH_FIXTURES=on.
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'];

async function expectBig(page: Page, selector: string, label: string) {
  await expect(async () => {
    const boxes = await page.locator(selector).evaluateAll((els) =>
      els
        .filter((el) => (el as HTMLElement).offsetParent !== null)
        .map((el) => {
          const r = el.getBoundingClientRect();
          return { text: (el.textContent ?? '').trim().slice(0, 30), h: r.height };
        }),
    );
    expect(boxes.length, `${label} found`).toBeGreaterThan(0);
    for (const box of boxes)
      expect(box.h, `${label} "${box.text}" height`).toBeGreaterThanOrEqual(43.5);
  }).toPass({ timeout: 10_000 });
}

async function expectNoAxeViolations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
}

const CONTROLS = '.acct a, .acct button, .acct input, .acct select, .acct [role="switch"]';

for (const path of ['/account', '/account/security', '/settings/playback', '/account/data']) {
  test(`${path} tap targets and overflow`, async ({ page }) => {
    await page.goto(path);
    await expect(page.locator('.acct h1')).toBeVisible();
    await expectBig(page, CONTROLS, 'account control');
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
}

test('delete dialog is accessible and keeps the button off until DELETE is typed', async ({
  page,
}) => {
  await page.goto('/account/data');
  await page.getByRole('button', { name: 'Delete account' }).click();
  const dialog = page.getByRole('dialog', { name: 'Delete your account?' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Delete my account' })).toHaveAttribute(
    'aria-disabled',
    'true',
  );
  await expectBig(page, '.acct-dialog input, .acct-dialog button', 'dialog control');
  await expectNoAxeViolations(page);
  await dialog.getByRole('button', { name: 'Keep my account' }).click();
  await expect(dialog).toBeHidden();
});

test('export password dialog is accessible', async ({ page }) => {
  await page.goto('/account/data');
  await page.getByRole('button', { name: 'Request export' }).click();
  await expect(page.getByRole('dialog', { name: 'Confirm your password' })).toBeVisible();
  // Let the dialog fade finish so axe reads the settled colours.
  await page.waitForTimeout(500);
  await expectNoAxeViolations(page);
});

test('password rules show as the field is typed', async ({ page }) => {
  await page.goto('/account/security');
  await page.getByLabel('New password').first().pressSequentially('Abcdefgh1!xyz');
  await expect(page.getByText(/\(met\)/).first()).toBeVisible();
  await expectNoAxeViolations(page);
});

for (const path of ['/terms', '/privacy', '/about', '/help']) {
  test(`${path} site tabs and links are big enough`, async ({ page }) => {
    await page.goto(path);
    await expectBig(page, '.acct-sitetab', 'site tab');
    await expectBig(page, '.ad-footer__links a', 'footer link');
  });
}

test('help search with no match shows the empty card', async ({ page }) => {
  await page.goto('/help');
  await page.getByRole('searchbox', { name: 'Search help' }).fill('passwrod');
  await expect(
    page.getByRole('heading', { name: 'No help articles match "passwrod"' }),
  ).toBeVisible();
  await expectBig(page, '.acct-help a.ad-btn', 'email support button');
  await expectNoAxeViolations(page);
});
