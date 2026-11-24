import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

// TV mode (M49-S15): from Home to the player using only arrow keys and Enter, no mouse.
// Fixture build, as home.e2e.ts. Nothing here clicks or hovers.

async function focusedMatches(page: Page, selector: string): Promise<boolean> {
  return page.evaluate((s) => document.activeElement?.matches(s) ?? false, selector);
}

async function arrowUntil(page: Page, selector: string, keys: string[], max = 60) {
  for (let i = 0; i < max; i += 1) {
    if (await focusedMatches(page, selector)) return;
    await page.keyboard.press(keys[i % keys.length] as string);
  }
  expect(await focusedMatches(page, selector), `focus reached ${selector}`).toBe(true);
}

test('/tv turns TV mode on and Home is reachable by the remote alone', async ({ page }) => {
  await page.goto('/tv');
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator('html')).toHaveAttribute('data-tv', 'on');

  await page.keyboard.press('ArrowDown');
  expect(await page.evaluate(() => document.activeElement !== document.body)).toBe(true);

  await arrowUntil(page, 'a[href^="/title/"], a[href^="/series/"]', ['ArrowDown', 'ArrowRight']);
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/(title|series)\//);

  await arrowUntil(page, 'a[href^="/watch/"]', ['ArrowDown', 'ArrowRight']);
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/watch\//);
});

test('the focus ring is thick on a focused tile', async ({ page }) => {
  await page.goto('/tv');
  await arrowUntil(page, 'a[href^="/title/"], a[href^="/series/"]', ['ArrowDown', 'ArrowRight']);
  const width = await page.evaluate(() => {
    const el = document.activeElement?.querySelector('.ad-card__thumb') ?? document.activeElement;
    return el ? getComputedStyle(el).outlineWidth : '0px';
  });
  expect(parseFloat(width)).toBeGreaterThanOrEqual(4);
});

test('with TV mode off nothing changes', async ({ page, context, baseURL }) => {
  await context.addCookies([
    { name: 'ad_tv', value: 'off', url: baseURL ?? 'http://localhost:3000' },
  ]);
  await page.goto('/');
  await expect(page.locator('html')).not.toHaveAttribute('data-tv', /.*/);
});
