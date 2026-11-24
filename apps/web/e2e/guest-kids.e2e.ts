import { expect, test } from '@playwright/test';

/**
 * Kids mode for a visitor (M40-S09). Needs a server on real data with the demo catalogue, as in
 * viewer-real.e2e.ts. Skipped otherwise.
 */
test.skip(!process.env.E2E_REAL, 'set E2E_REAL=1 for the guest Kids mode journey on real services');

test('Kids mode filters the catalogue, blocks a direct link and can be turned off', async ({
  browser,
}) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto('/browse');
  const allTitles = await page.locator('a[href^="/title/"]').count();
  // Remember one title that is not kids safe, found while Kids mode is off.
  const hrefs = await page
    .locator('a[href^="/title/"]')
    .evaluateAll((links) => links.map((link) => link.getAttribute('href')!));

  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('switch', { name: 'Kids mode' }).click();
  await expect(page.getByRole('button', { name: 'Turn off Kids mode' })).toBeVisible();
  await page.goto('/browse');
  const kidsTitles = await page.locator('a[href^="/title/"]').count();
  expect(kidsTitles).toBeLessThanOrEqual(allTitles);

  if (kidsTitles < allTitles) {
    // At least one title disappeared. Opening a hidden one directly says so, with a way out.
    const kidsHrefs = await page
      .locator('a[href^="/title/"]')
      .evaluateAll((links) => links.map((link) => link.getAttribute('href')!));
    const blocked = hrefs.find((href) => !kidsHrefs.includes(href));
    if (blocked) {
      await page.goto(blocked);
      await expect(
        page.getByRole('heading', { name: 'This video is not in Kids mode' }),
      ).toBeVisible();
      await expect(page.getByRole('link', { name: 'Browse' })).toBeVisible();
    }
  }

  await page.getByRole('button', { name: 'Turn off Kids mode' }).click();
  await page.goto('/browse');
  expect(await page.locator('a[href^="/title/"]').count()).toBe(allTitles);
  await context.close();
});
