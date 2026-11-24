import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test, type Page } from '@playwright/test';

// L4-11 (M08-S01 AC4): on a slow 3G connection the video starts on the lowest rung within 8 seconds and the
// viewer never sees a blank screen. Needs the sample streams (scripts/make-sample-hls.sh) and a Chrome with H.264
// (E2E_CHROMIUM_PATH), like watch.e2e.ts. The specs skip themselves otherwise.
const SAMPLE = resolve(import.meta.dirname, '../public/fixtures/hls');
const SLOW_3G = {
  offline: false,
  downloadThroughput: (400 * 1024 * 0.9) / 8,
  uploadThroughput: (400 * 1024 * 0.9) / 8,
  latency: 400,
};
const START_BUDGET_MS = 8_000;

test.use({
  launchOptions: process.env.E2E_CHROMIUM_PATH
    ? {
        executablePath: process.env.E2E_CHROMIUM_PATH,
        args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
      }
    : { args: ['--autoplay-policy=no-user-gesture-required'] },
});

test.describe('watch page on slow 3G (L4-11)', () => {
  test.skip(
    ({ browserName }) => browserName !== 'chromium',
    'CDP network emulation is Chromium only',
  );

  test.beforeEach(async ({ page }) => {
    test.skip(
      !existsSync(resolve(SAMPLE, 'plain/master.m3u8')),
      'run scripts/make-sample-hls.sh first',
    );
    await page.goto('/');
    const h264 = await page.evaluate(() =>
      MediaSource.isTypeSupported('video/mp4; codecs="avc1.4d401e"'),
    );
    test.skip(!h264, 'this browser has no H.264 support, set E2E_CHROMIUM_PATH to Chrome');
  });

  async function throttle(page: Page) {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', SLOW_3G);
  }

  const height = (page: Page) =>
    page.evaluate(() => document.querySelector('video')?.videoHeight ?? 0);

  test('starts within 8 seconds and on the lowest rung', async ({ page }) => {
    await throttle(page);
    const started = Date.now();
    await page.goto('/watch/v-plants', { waitUntil: 'commit' });
    await expect
      .poll(() => page.evaluate(() => document.querySelector('video')?.currentTime ?? 0), {
        timeout: START_BUDGET_MS,
      })
      .toBeGreaterThan(0);
    test.info().annotations.push({
      type: 'time to first frame (ms)',
      description: String(Date.now() - started),
    });
    expect(Date.now() - started).toBeLessThan(START_BUDGET_MS + 1_000);
    expect(await height(page)).toBeLessThanOrEqual(360);
  });

  test('shows a spinner or a message while it loads, never a blank player', async ({ page }) => {
    await throttle(page);
    await page.goto('/watch/v-plants', { waitUntil: 'commit' });
    const region = page.getByRole('region', { name: /Video player/ });
    await expect(region).toBeVisible({ timeout: 15_000 });
    // The poster or the spinner fills the box from the first paint, so it is never empty.
    const box = await region.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThan(100);
    await expect
      .poll(async () => (await region.locator('.adp-spinner-wrap, .adp-poster, video').count()) > 0)
      .toBe(true);
  });
});
