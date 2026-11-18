import { expect, test } from '@playwright/test';

// The fixture session is signed in as the first profile, so Home renders without a login step.
test('Home shows the hero, rows and the main navigation', async ({ page }) => {
  await page.goto('/');
  await expect(
    page
      .getByRole('region', { name: /featured/i })
      .or(page.getByRole('heading', { level: 1 }))
      .first(),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'My List' }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'Browse' }).first()).toBeVisible();
});

test('a card opens its title page', async ({ page }) => {
  await page.goto('/');
  const card = page.getByRole('link', { name: /min$|minutes?|episodes?/i }).first();
  await card.click();
  await expect(page).toHaveURL(/\/(title|series)\//);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});

test('search finds a video by keyword', async ({ page }) => {
  await page.goto('/search?q=water');
  await expect(page.getByText(/\d+ results?/)).toBeVisible();
});
