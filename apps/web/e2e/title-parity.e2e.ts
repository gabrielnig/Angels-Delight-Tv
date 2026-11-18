import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

// S18 title page: axe, overflow, touch targets and the phone sticky Play bar.
// Fixture build: VIEWER_FIXTURES=on AUTH_FIXTURES=on ADMIN_DATA=fixture.
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'];
const PAGES = ['/title/how-rain-is-made', '/title/counting-money', '/title/no-such-video'];

async function expectBig(page: Page, selector: string, label: string) {
  const boxes = await page.locator(selector).evaluateAll((els) =>
    els
      .filter((el) => (el as HTMLElement).offsetParent !== null)
      .map((el) => {
        const r = el.getBoundingClientRect();
        return { text: (el.textContent ?? '').trim().slice(0, 30), w: r.width, h: r.height };
      }),
  );
  expect(boxes.length, `${label} found`).toBeGreaterThan(0);
  for (const box of boxes) {
    expect(box.h, `${label} "${box.text}" height`).toBeGreaterThanOrEqual(43.5);
    expect(box.w, `${label} "${box.text}" width`).toBeGreaterThanOrEqual(43.5);
  }
}

for (const path of PAGES) {
  test(`axe and overflow ${path}`, async ({ page }) => {
    await page.goto(path, { waitUntil: 'networkidle' });
    const result = await new AxeBuilder({ page }).withTags(TAGS).analyze();
    expect(
      result.violations.map(
        (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`,
      ),
    ).toEqual([]);
    await page.setViewportSize({ width: 320, height: 640 });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
}

test('title page touch targets', async ({ page }) => {
  await page.goto('/title/how-rain-is-made', { waitUntil: 'networkidle' });
  await expectBig(page, '.tv-actions .ad-btn', 'action button');
  await expectBig(page, '.tv-desc .web-expandable__toggle', 'show more');
  await expectBig(page, '.tv-related__card', 'related card');
  await expectBig(page, '.tv-poster__button', 'poster play');
  if (await page.locator('.tv-crumbs').isVisible())
    await expectBig(page, '.tv-crumbs a', 'breadcrumb link');
});

test('phones get a sticky Play bar and a Back button instead of the tab bar', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'mobile', 'phone only');
  await page.goto('/title/how-rain-is-made', { waitUntil: 'networkidle' });
  const bar = page.locator('.tv-sticky a');
  await expect(bar).toBeVisible();
  const box = await bar.boundingBox();
  const view = page.viewportSize()!;
  expect(box!.y + box!.height).toBeLessThanOrEqual(view.height);
  expect(box!.y).toBeGreaterThan(view.height - 120);
  await expect(page.getByRole('navigation', { name: 'Primary' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Back' })).toBeVisible();
  await expectBig(page, '.tv-sticky a', 'sticky play');
  await expectBig(page, '.ad-nav__back', 'back button');
});

test('desktop hides the sticky bar and the Back button', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'desktop only');
  await page.goto('/title/how-rain-is-made', { waitUntil: 'networkidle' });
  await expect(page.locator('.tv-sticky')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Back' })).toBeHidden();
  await expect(page.locator('.tv-related__item:visible')).toHaveCount(5);
});

test('a missing title shows the not found card inside the page chrome', async ({ page }) => {
  await page.goto('/title/no-such-video');
  await expect(page.getByRole('heading', { name: 'We could not find that video' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Browse subjects' })).toHaveAttribute(
    'href',
    '/browse',
  );
  await expect(page.locator('header')).toBeVisible();
});
