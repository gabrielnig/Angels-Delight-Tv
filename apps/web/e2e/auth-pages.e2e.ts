import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

// S01 sign in and S02 sign up, rebuilt to the mockups. Fixture build: VIEWER_FIXTURES=on AUTH_FIXTURES=on.
// Runs on mobile (360 by 740) and desktop (docs/TESTING.md section 6).
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'];

async function noOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

async function bigTargets(page: Page, selector: string) {
  const boxes = await page.locator(selector).evaluateAll((els) =>
    els
      .filter((el) => (el as HTMLElement).offsetParent !== null)
      .map((el) => {
        const r = el.getBoundingClientRect();
        return {
          text: (el.textContent ?? el.getAttribute('aria-label') ?? '').trim().slice(0, 30),
          w: r.width,
          h: r.height,
        };
      }),
  );
  expect(boxes.length).toBeGreaterThan(0);
  for (const box of boxes) {
    expect(box.w, `"${box.text}" width`).toBeGreaterThanOrEqual(43.5);
    expect(box.h, `"${box.text}" height`).toBeGreaterThanOrEqual(43.5);
  }
}

test.describe('S01 sign in', () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
  });

  test('default state has no axe violations, no overflow and 44px targets', async ({ page }) => {
    await page.goto('/sign-in');
    await expect(page.getByRole('heading', { level: 1, name: 'Sign in' })).toBeVisible();
    const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
    expect(results.violations).toEqual([]);
    await noOverflow(page);
    await bigTargets(page, '.auth-link, .auth-field__action, .auth-submit');
    for (const input of await page.locator('.auth-input').all()) {
      expect((await input.boundingBox())?.height).toBeGreaterThanOrEqual(48);
    }
  });

  test('inputs show the mockup focus ring', async ({ page }) => {
    await page.goto('/sign-in');
    await page.getByLabel('Email').focus();
    const shadow = await page.getByLabel('Email').evaluate((el) => getComputedStyle(el).boxShadow);
    expect(shadow).not.toBe('none');
    expect(
      await page.getByLabel('Email').evaluate((el) => getComputedStyle(el).borderTopWidth),
    ).toBe('2px');
  });

  test('wrong credentials: generic banner, no axe violations, values kept', async ({ page }) => {
    await page.goto('/sign-in');
    await page.getByLabel('Email').fill('ngozi.eze@gmail.com');
    await page.getByLabel('Password', { exact: true }).fill('wrong-password');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.locator('.auth-banner[data-tone="danger"]')).toContainText(
      'That email or password is not right. Check them and try again.',
    );
    await expect(page.getByLabel('Email')).toHaveValue('ngozi.eze@gmail.com');
    const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
    expect(results.violations).toEqual([]);
  });

  test('session ended notice shows as information', async ({ page }) => {
    await page.goto('/sign-in?next=%2Fmy-list&notice=ended');
    await expect(page.locator('.auth-banner[data-tone="info"]')).toContainText(
      'Your session ended. Sign in again to keep watching.',
    );
    const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
    expect(results.violations).toEqual([]);
  });

  test('password reset notice shows as success', async ({ page }) => {
    await page.goto('/sign-in?notice=reset');
    await expect(page.locator('.auth-banner[data-tone="success"]')).toContainText(
      'Your password was changed.',
    );
  });

  test('keyboard reaches every control in reading order', async ({ page }) => {
    await page.goto('/sign-in');
    await page.getByLabel('Email').focus();
    await page.keyboard.press('Tab');
    await expect(page.getByLabel('Password', { exact: true })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Show password' })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'Forgot your password?' })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeFocused();
  });

  test('works at 320px without sideways scrolling', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto('/sign-in');
    await noOverflow(page);
  });
});

test.describe('S02 sign up', () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
  });

  test('default state has no axe violations, no overflow and 44px targets', async ({ page }) => {
    await page.goto('/sign-up');
    await expect(
      page.getByRole('heading', { level: 1, name: 'Create your account' }),
    ).toBeVisible();
    const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
    expect(results.violations).toEqual([]);
    await noOverflow(page);
    await bigTargets(page, '.auth-link, .auth-field__action, .auth-submit, .auth-header__button');
  });

  test('desktop has the Have an account bar, mobile has the sticky submit bar', async ({
    page,
  }, info) => {
    await page.goto('/sign-up');
    const bar = page.locator('.auth-header__account');
    const sticky = page.locator('.auth-sticky');
    if (info.project.name === 'mobile') {
      await expect(bar).toBeHidden();
      const viewport = page.viewportSize()!;
      const box = (await sticky.boundingBox())!;
      expect(Math.round(box.y + box.height)).toBe(viewport.height);
      // Still pinned to the bottom after scrolling a long form (the Next dev overlay adds height in dev only).
      await page.evaluate(() => document.querySelector('nextjs-portal')?.remove());
      await page.getByLabel(/^Password \(required\)/).fill('blue mango river sunrise');
      await page.mouse.wheel(0, 400);
      const after = (await sticky.boundingBox())!;
      expect(Math.round(after.y + after.height)).toBe(viewport.height);
    } else {
      await expect(bar).toBeVisible();
      await expect(bar).toContainText('Have an account?');
      await expect(bar.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/sign-in');
    }
  });

  test('terms line keeps its words together and the links have a 44px hit area', async ({
    page,
  }) => {
    await page.goto('/sign-up');
    const fine = page.locator('.auth-fine');
    await expect(fine).toHaveText(
      'By creating an account you agree to the Terms and Privacy Policy.',
    );
    const link = fine.getByRole('link', { name: 'Terms' });
    const box = (await link.boundingBox())!;
    const hit = await page.evaluate(
      ({ x, y }) => document.elementFromPoint(x, y)?.closest('a')?.textContent,
      { x: box.x + box.width / 2, y: box.y + box.height / 2 + 16 },
    );
    expect(hit).toBe('Terms');
  });

  test('typing a short password shows Weak, the fix and no axe violations', async ({ page }) => {
    await page.goto('/sign-up');
    await page.getByLabel(/^Email/).fill('chioma.okafor@gmail.com');
    await page.getByLabel(/^Password \(required\)/).fill('lagos2026');
    await page.getByLabel(/^Password \(required\)/).blur();
    await expect(page.locator('.auth-meter__word')).toHaveText('Weak');
    await expect(page.getByText('Use at least 10 characters.')).toBeVisible();
    const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
    expect(results.violations).toEqual([]);
  });

  test('a strong password fills the meter and ticks every rule', async ({ page }) => {
    await page.goto('/sign-up');
    await page.getByLabel(/^Password \(required\)/).fill('blue mango river sunrise');
    await expect(page.locator('.auth-meter__word')).toHaveText('Strong');
    await expect(page.locator('.auth-checklist li[data-met="true"]')).toHaveCount(3);
  });

  test('network error keeps the values and explains the next step', async ({ page }) => {
    await page.goto('/sign-up');
    await page.getByLabel(/^Email/).fill('chioma.okafor@gmail.com');
    await page.getByLabel(/^Password \(required\)/).fill('offline-please');
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page.locator('.auth-banner[data-tone="danger"]')).toContainText(
      'Your details are saved here.',
    );
    await expect(page.getByLabel(/^Email/)).toHaveValue('chioma.okafor@gmail.com');
  });

  test('rate limited gives a warning with the wait time', async ({ page }) => {
    await page.goto('/sign-up');
    await page.getByLabel(/^Email/).fill('chioma.okafor@gmail.com');
    await page.getByLabel(/^Password \(required\)/).fill('rate-limit-please');
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page.locator('.auth-banner[data-tone="warning"]')).toContainText(
      'Try again in 15 minutes.',
    );
  });

  test('works at 320px without sideways scrolling', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto('/sign-up');
    await noOverflow(page);
  });
});
