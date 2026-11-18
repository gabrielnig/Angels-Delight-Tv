import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

// Design review gate: axe-core on every key page, plus a 320px horizontal overflow check.
// Fixture build: VIEWER_FIXTURES=on AUTH_FIXTURES=on ADMIN_FIXTURES=on (see docs/lanes/J3-design-review.md).
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'];

const VIEWER_PAGES = [
  '/',
  '/browse',
  '/browse/science',
  '/search?q=water',
  '/my-list',
  '/title/counting-money',
  '/series/everyday-science',
  '/profiles',
  '/profiles/manage',
  '/profiles/new',
  '/account',
  '/account/security',
  '/account/data',
  '/settings/playback',
  '/about',
  '/help',
  '/privacy',
  '/terms',
  '/offline',
  '/maintenance',
  '/unsupported',
  '/watch/vid-003',
];

const AUTH_PAGES = [
  '/sign-in',
  '/sign-up',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
  '/admin/login',
  '/admin/invite/abc',
];

const ADMIN_PAGES = [
  '/admin',
  '/admin/videos',
  '/admin/videos/upload',
  '/admin/videos/trash',
  '/admin/videos/vid_rivers',
  '/admin/videos/vid_rivers/poster',
  '/admin/captions',
  '/admin/captions/vid_money_data',
  '/admin/series',
  '/admin/series/ser_maths',
  '/admin/categories',
  '/admin/encoding',
  '/admin/home',
  '/admin/theme',
  '/admin/theme/history',
  '/admin/users',
  '/admin/users/usr_1',
  '/admin/analytics',
  '/admin/audit-log',
  '/admin/roles',
  '/admin/site-settings',
  '/admin/system',
  '/admin/account',
];

// The Super admin sees every admin screen, including roles, audit log and system.
async function adminSignIn(page: Page) {
  await page.goto('/admin/login');
  await page.getByLabel('Email').fill('arkdev@example.test');
  await page.getByLabel('Password').fill('fixture-password');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByLabel('Digit 1 of 6').click();
  await page.keyboard.type('123456');
  await page.getByRole('button', { name: 'Verify' }).click();
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
}

async function check(page: Page, path: string) {
  await page.goto(path, { waitUntil: 'networkidle' });
  const result = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  const summary = result.violations.map(
    (v) =>
      `${v.id} (${v.impact}): ${v.nodes
        .map((n) => n.target.join(' '))
        .slice(0, 3)
        .join(' | ')}`,
  );
  expect(summary, `axe violations on ${path}`).toEqual([]);

  await page.setViewportSize({ width: 320, height: 640 });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, `horizontal overflow at 320px on ${path}`).toBeLessThanOrEqual(0);
}

// Known failures with an owner. Each one is a real finding, not a spec problem, and is listed in
// docs/lanes/F2-final-verification.md. Remove the entry when the fix lands.
const KNOWN_FAILING: Record<string, string> = {
  '/settings/playback':
    'The caption preview colours are set with an inline style attribute, which the CSP blocks, so the text is dark on dark (S29 owner).',
  '/account':
    'axe dlitem: dt and dd elements without a dl parent on the overview cards (S27 owner).',
  '/about': 'axe heading-order: a section starts at h3 with no h2 before it (S31 owner).',
};

test.describe('axe and overflow, viewer', () => {
  for (const path of VIEWER_PAGES) {
    test(path, async ({ page }) => {
      test.fixme(path in KNOWN_FAILING, KNOWN_FAILING[path]);
      await check(page, path);
    });
  }
});

test.describe('axe and overflow, signed out and auth', () => {
  for (const path of AUTH_PAGES) {
    test(path, async ({ page, context }) => {
      await context.clearCookies();
      await check(page, path);
    });
  }
});

test.describe('axe and overflow, admin', () => {
  for (const path of ADMIN_PAGES) {
    test(path, async ({ page }) => {
      await adminSignIn(page);
      await check(page, path);
    });
  }
});
