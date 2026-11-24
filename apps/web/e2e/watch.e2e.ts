import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test, type Page } from '@playwright/test';

// Generate the sample streams first: scripts/make-sample-hls.sh
// The sample is H.264, so the browser needs proprietary codecs. Playwright's bundled Chromium has none:
// run with E2E_CHROMIUM_PATH pointing at Chrome (for example /opt/google/chrome/chrome). The spec skips itself otherwise.
const SAMPLE = resolve(import.meta.dirname, '../public/fixtures/hls');
const KEY_FILE = resolve(SAMPLE, 'enc/enc.key');

test.use({
  launchOptions: process.env.E2E_CHROMIUM_PATH
    ? {
        executablePath: process.env.E2E_CHROMIUM_PATH,
        args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
      }
    : { args: ['--autoplay-policy=no-user-gesture-required'] },
});

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

const currentTime = (page: Page) =>
  page.evaluate(() => document.querySelector('video')?.currentTime ?? 0);

async function expectPlaying(page: Page, minSeconds = 1.5) {
  await expect.poll(() => currentTime(page), { timeout: 25_000 }).toBeGreaterThan(minSeconds);
}

test('plays the unencrypted sample with controls, captions, quality and progress', async ({
  page,
}) => {
  await page.goto('/watch/v-plants');
  await expect(
    page.getByRole('heading', { level: 1, name: 'How Plants Make Their Own Food' }),
  ).toBeVisible();
  const region = page.getByRole('region', { name: /Video player/ });
  await expect(region).toBeVisible();
  await expectPlaying(page);

  // Quality ladder comes from the real playlists, behind the one Settings button.
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('menuitem', { name: /^Quality/ }).click();
  const menu = page.getByRole('menu', { name: 'Quality' });
  await expect(menu.getByRole('menuitemradio')).toHaveCount(4);
  await menu.getByRole('menuitemradio', { name: '360p', exact: true }).click();
  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(page.getByRole('menuitem', { name: 'Quality, 360p' })).toBeVisible();
  await page.keyboard.press('Escape');

  // Captions toggle, with only the approved track attached.
  await expect(page.locator('video track')).toHaveCount(1);
  await page.getByRole('button', { name: 'Captions' }).click();
  await expect(page.getByRole('button', { name: 'Captions' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );

  // Pause saves progress at once.
  await page.getByRole('button', { name: 'Pause' }).click();
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('ad.progress.prof_fixture.v-plants')))
    .toContain('positionSeconds');
});

test('keyboard shortcuts work and the help dialog opens', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard journey runs on desktop');
  await page.goto('/watch/v-plants');
  await expectPlaying(page);
  const region = page.getByRole('region', { name: /Video player/ });
  await region.focus();
  await page.keyboard.press('k');
  await expect.poll(() => page.evaluate(() => document.querySelector('video')?.paused)).toBe(true);
  const before = await currentTime(page);
  await page.keyboard.press('l');
  await expect.poll(() => currentTime(page)).toBeGreaterThan(before + 8);
  await page.keyboard.press('Shift+Slash');
  await expect(page.getByRole('dialog', { name: 'Keyboard shortcuts' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('resumes 3 seconds before the saved position and offers Start over', async ({ page }) => {
  await page.goto('/watch/v-rain');
  await expect(page.getByText('Resumed from 0:14')).toBeVisible();
  await expectPlaying(page, 11);
  await page.getByRole('button', { name: 'Start over' }).click();
  await expect.poll(() => currentTime(page), { timeout: 5_000 }).toBeLessThan(8);
});

test('?t overrides the saved position', async ({ page }) => {
  await page.goto('/watch/v-rain?t=18');
  await expectPlaying(page, 18);
  await expect(page.getByText(/Resumed from/)).toHaveCount(0);
});

test('plays the AES-128 sample through the ad-key loader with the bearer token on the key request', async ({
  page,
}) => {
  test.skip(!existsSync(KEY_FILE), 'encrypted sample missing');
  const key = readFileSync(KEY_FILE);
  const seen: Array<string | undefined> = [];
  await page.route('**/api/hls/keys/sample', async (route) => {
    seen.push(route.request().headers().authorization);
    await route.fulfill({
      status: 200,
      body: key,
      headers: { 'content-type': 'application/octet-stream' },
    });
  });
  await page.goto('/watch/v-encrypted');
  await expectPlaying(page);
  expect(seen.length).toBeGreaterThan(0);
  expect(seen[0]).toBe('Bearer fixture-token');
});

test('recovers from a 401 on the key by refreshing the token once', async ({ page }) => {
  test.skip(!existsSync(KEY_FILE), 'encrypted sample missing');
  const key = readFileSync(KEY_FILE);
  let calls = 0;
  await page.route('**/api/hls/keys/sample', async (route) => {
    calls += 1;
    if (calls === 1) return route.fulfill({ status: 401, body: '' });
    return route.fulfill({
      status: 200,
      body: key,
      headers: { 'content-type': 'application/octet-stream' },
    });
  });
  await page.goto('/watch/v-encrypted');
  await expectPlaying(page);
  expect(calls).toBeGreaterThanOrEqual(2);
  await expect(page.locator('.adp [role="alert"]')).toHaveCount(0);
});

test('shows Sign in again when the key keeps answering 401', async ({ page }) => {
  test.skip(!existsSync(KEY_FILE), 'encrypted sample missing');
  await page.route('**/api/hls/keys/sample', (route) => route.fulfill({ status: 401, body: '' }));
  await page.goto('/watch/v-encrypted');
  await expect(page.locator('.adp [role="alert"]')).toContainText(
    'Sign in again to keep watching',
    { timeout: 30_000 },
  );
  await expect(page.getByRole('link', { name: 'Sign in' })).toHaveAttribute(
    'href',
    /\/signin\?next=/,
  );
});

test('shows This video is no longer available when the playlist is gone', async ({ page }) => {
  await page.route('**/fixtures/hls/plain/master.m3u8', (route) =>
    route.fulfill({ status: 404, body: '' }),
  );
  await page.goto('/watch/v-plants');
  await expect(page.locator('.adp [role="alert"]')).toContainText(
    'This video is no longer available',
    { timeout: 30_000 },
  );
});

test('the next episode shortcut navigates, and an unknown video shows the not found page', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'keyboard journey runs on desktop');
  await page.goto('/watch/v-sky');
  const region = page.getByRole('region', { name: /Video player/ });
  await expectPlaying(page, 0.5);
  await region.focus();
  await page.keyboard.press('n');
  await expect(page).toHaveURL(/\/watch\/v-sun$/);

  const missing = await page.goto('/watch/does-not-exist');
  expect(missing?.status()).toBe(404);
  await expect(page.getByRole('heading', { name: 'This video is not available' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Search' })).toBeVisible();
});

test('mobile: compact controls and double tap to seek', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'touch journey runs on mobile');
  await page.goto('/watch/v-plants');
  await expectPlaying(page, 1);
  await expect(page.getByRole('slider', { name: 'Volume' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Settings' })).toBeVisible();
  const box = await page.locator('.adp-surface').boundingBox();
  if (!box) throw new Error('no surface');
  const before = await currentTime(page);
  const x = box.x + box.width * 0.85;
  const y = box.y + box.height * 0.25;
  await page.touchscreen.tap(x, y);
  await page.waitForTimeout(80);
  await page.touchscreen.tap(x, y);
  await expect(page.getByText('+10')).toBeVisible();
  await expect.poll(() => currentTime(page)).toBeGreaterThan(before + 8);
});
