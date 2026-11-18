import { expect, test, type Page } from '@playwright/test';

// M03-S13 AC1: on a 3G connection the picker tiles show within 2 seconds on a repeat visit.
// Chrome "Fast 3G" figures: 1.6 Mbit/s down, 750 kbit/s up, 562.5 ms round trip, minus the usual 10 percent.
const FAST_3G = {
  offline: false,
  downloadThroughput: (1.6 * 1024 * 1024 * 0.9) / 8,
  uploadThroughput: (750 * 1024 * 0.9) / 8,
  latency: 562.5,
};
const TARGET_MS = 2000;
const CACHE_KEY = 'ad.pickercache.v1';

async function throttle(page: Page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', FAST_3G);
}

test.describe('profile picker on 3G (M03-S13)', () => {
  test.skip(
    ({ browserName }) => browserName !== 'chromium',
    'CDP network emulation is Chromium only',
  );

  test('a repeat visit paints the tiles within 2 seconds', async ({ page, context }) => {
    // First visit on a good connection: saves the cache and warms the static files.
    await page.goto('/profiles');
    await expect(page.getByRole('button', { name: /^Switch to / }).first()).toBeVisible();
    await expect
      .poll(() => page.evaluate((key) => localStorage.getItem(key), CACHE_KEY))
      .not.toBeNull();
    const saved = await page.evaluate((key) => localStorage.getItem(key), CACHE_KEY);
    const accountId = JSON.parse(saved!).accountId as string;
    await context.addCookies([
      { name: 'ad_acct', value: accountId, url: new URL(page.url()).origin },
    ]);

    await throttle(page);
    const started = Date.now();
    await page.goto('/profiles', { waitUntil: 'commit' });
    await expect(page.getByRole('button', { name: /^Switch to / }).first()).toBeVisible({
      timeout: 15_000,
    });
    const elapsed = Date.now() - started;
    test.info().annotations.push({ type: 'tiles painted (ms)', description: String(elapsed) });
    expect(elapsed).toBeLessThan(TARGET_MS);
  });

  test('the cache holds only what the picker draws', async ({ page }) => {
    await page.goto('/profiles');
    await expect(page.getByRole('button', { name: /^Switch to / }).first()).toBeVisible();
    // The cache is written after hydration, so wait for it.
    await expect
      .poll(() => page.evaluate((key) => localStorage.getItem(key), CACHE_KEY))
      .not.toBeNull();
    const stored = await page.evaluate((key) => localStorage.getItem(key), CACHE_KEY);
    for (const field of ['language', 'dataSaver', 'lastUsedHere', 'autoplayNext', 'email']) {
      expect(stored).not.toContain(field);
    }
  });
});
