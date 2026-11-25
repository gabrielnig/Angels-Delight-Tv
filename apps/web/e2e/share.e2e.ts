import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

/**
 * The Share sheet (L15a): measured layout at 320, 360, 414 and desktop widths, target sizes, no horizontal overflow,
 * the sheet position, keyboard and focus, the clean link, copy, swipe down, reduced motion and axe.
 * Fixture build: VIEWER_FIXTURES=on AUTH_FIXTURES=on ADMIN_DATA=fixture (scripts/ci-fixture-env.sh).
 * Layout is set per test with setViewportSize, so only the desktop project runs this file.
 */
const TITLE = '/title/how-rain-is-made';
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'];
const PLACES = ['Copy link', 'WhatsApp', 'Facebook', 'X', 'Telegram', 'Email', 'Messages'];

test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'viewport is set inside each test');
});

async function open(page: Page, width: number, height = 800, path = TITLE) {
  await page.setViewportSize({ width, height });
  await page.goto(path, { waitUntil: 'networkidle' });
  const button = page.getByRole('button', { name: 'Share', exact: true }).first();
  await button.click();
  const dialog = page.getByRole('dialog', { name: /^Share this/ });
  await expect(dialog).toBeVisible();
  return { dialog, button };
}

async function box(locator: Locator) {
  const b = await locator.boundingBox();
  if (!b) throw new Error('not visible');
  return b;
}

for (const width of [320, 360, 414]) {
  test(`bottom sheet at ${width}: position, targets, no overflow`, async ({ page }) => {
    const { dialog } = await open(page, width, 740);
    await expect(dialog).toHaveAttribute('data-mode', 'sheet');
    // Let the slide in finish before measuring.
    await page.waitForTimeout(400);
    const d = await box(dialog);
    expect(d.x, 'left edge').toBeCloseTo(0, 0);
    expect(d.width, 'full width').toBeCloseTo(width, 0);
    expect(d.y + d.height, 'sits on the bottom edge').toBeCloseTo(740, 0);
    expect(d.y, 'does not leave the top').toBeGreaterThanOrEqual(0);
    expect(d.height, 'at most 90 percent high').toBeLessThanOrEqual(740 * 0.9 + 1);

    const overflow = await page.evaluate(() => ({
      page: document.documentElement.scrollWidth - window.innerWidth,
      dialog: (() => {
        const el = document.querySelector('[role="dialog"]') as HTMLElement;
        return el.scrollWidth - el.clientWidth;
      })(),
    }));
    expect(overflow.page, 'page overflow').toBeLessThanOrEqual(0);
    expect(overflow.dialog, 'sheet overflow').toBeLessThanOrEqual(0);

    for (const name of PLACES) {
      const target = dialog.getByText(name, { exact: true }).locator('xpath=ancestor::*[@data-testid="share-target"]');
      const b = await box(target);
      expect(b.width, `${name} width`).toBeGreaterThanOrEqual(43.5);
      expect(b.height, `${name} height`).toBeGreaterThanOrEqual(43.5);
      expect(b.x, `${name} inside left`).toBeGreaterThanOrEqual(d.x - 0.5);
      expect(b.x + b.width, `${name} inside right`).toBeLessThanOrEqual(d.x + d.width + 0.5);
    }
    for (const control of [
      dialog.getByRole('button', { name: 'Close' }),
      dialog.getByRole('button', { name: 'Copy', exact: true }),
      dialog.getByLabel('Link to share'),
    ]) {
      const b = await box(control);
      expect(b.height).toBeGreaterThanOrEqual(43.5);
      expect(b.width).toBeGreaterThanOrEqual(43.5);
    }
    const clipped = await dialog.locator('.share-target__label').evaluateAll((els) =>
      els.filter((el) => el.scrollWidth > el.clientWidth + 1).map((el) => el.textContent),
    );
    expect(clipped, 'labels never cut').toEqual([]);
  });
}

test('desktop popover hangs from the button inside the window', async ({ page }) => {
  const { dialog, button } = await open(page, 1360, 800);
  await expect(dialog).toHaveAttribute('data-mode', 'popover');
  await page.waitForTimeout(400);
  const d = await box(dialog);
  const b = await box(button);
  expect(d.y, 'below the button').toBeGreaterThanOrEqual(b.y + b.height);
  expect(d.x).toBeGreaterThanOrEqual(15);
  expect(d.x + d.width).toBeLessThanOrEqual(1360 - 15);
  expect(d.y + d.height).toBeLessThanOrEqual(800);
  expect(d.width).toBeLessThanOrEqual(381);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test('a narrow window above 600 px keeps the popover inside it', async ({ page }) => {
  const { dialog } = await open(page, 640, 800);
  await page.waitForTimeout(400);
  const d = await box(dialog);
  expect(d.x).toBeGreaterThanOrEqual(15);
  expect(d.x + d.width).toBeLessThanOrEqual(640 - 15);
});

test('a short window becomes a centred dialog', async ({ page }) => {
  const { dialog } = await open(page, 1000, 500);
  await expect(dialog).toHaveAttribute('data-mode', 'dialog');
  await page.waitForTimeout(400);
  const d = await box(dialog);
  expect(d.y).toBeGreaterThanOrEqual(0);
  expect(d.y + d.height).toBeLessThanOrEqual(500);
  expect(Math.abs(d.x + d.width / 2 - 500)).toBeLessThan(2);
});

test('keyboard: focus moves in, stays in, Escape closes and returns to Share', async ({ page }) => {
  const { dialog, button } = await open(page, 414, 740);
  const inside = () => page.evaluate(() => document.querySelector('[role="dialog"]')!.contains(document.activeElement));
  expect(await inside()).toBe(true);
  for (let i = 0; i < 18; i++) {
    await page.keyboard.press('Tab');
    expect(await inside(), `tab ${i}`).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(button).toBeFocused();
});

test('the link is the clean title address and Copy link says so', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const { dialog } = await open(page, 390, 740, `${TITLE}?utm_source=x&s=wa#top`);
  const link = await dialog.getByLabel('Link to share').inputValue();
  expect(link).toMatch(/\/title\/how-rain-is-made$/);
  expect(link).not.toContain('?');
  expect(link).not.toContain('#');
  await dialog.getByRole('button', { name: 'Copy link' }).click();
  await expect(dialog.getByRole('status')).toHaveText('Link copied');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(link);
  const wa = dialog.getByRole('link', { name: /WhatsApp/ });
  expect(decodeURIComponent((await wa.getAttribute('href')) ?? '')).toContain(link);
  await expect(wa).toHaveAttribute('target', '_blank');
  await expect(wa).toHaveAttribute('rel', 'noopener noreferrer');
});

test('swiping the handle down closes the sheet', async ({ page }) => {
  const { dialog } = await open(page, 390, 740);
  await page.waitForTimeout(400);
  const grab = await box(page.getByTestId('share-grab'));
  await page.mouse.move(grab.x + grab.width / 2, grab.y + 10);
  await page.mouse.down();
  await page.mouse.move(grab.x + grab.width / 2, grab.y + 150, { steps: 6 });
  await page.mouse.move(grab.x + grab.width / 2, grab.y + 320, { steps: 6 });
  await page.mouse.up();
  await expect(dialog).toBeHidden();
});

test('reduced motion removes the slide', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const { dialog } = await open(page, 390, 740);
  const name = await dialog.evaluate((el) => getComputedStyle(el).animationName);
  expect(name).toBe('none');
});

for (const width of [360, 1360]) {
  test(`axe finds nothing serious in the open sheet at ${width}`, async ({ page }) => {
    await open(page, width, 800);
    const result = await new AxeBuilder({ page }).withTags(TAGS).include('[role="dialog"]').analyze();
    expect(
      result.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`),
    ).toEqual([]);
  });
}

test('the watch page shares the title page, not the watch address', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 740 });
  await page.goto('/watch/v-rain', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Share', exact: true }).first().click();
  const link = await page.getByLabel('Link to share').inputValue();
  expect(link).toMatch(/\/title\/v-rain$/);
  expect(link).not.toContain('/watch/');
});
