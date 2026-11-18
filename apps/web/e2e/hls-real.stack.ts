import { expect, test, type Page } from '@playwright/test';
import { startRealHlsStack, type RealHlsStack } from './support/real-hls-stack';

/**
 * Real hls.js, real AES-128 key flow, real edge worker. See support/real-hls-stack.ts for what is real.
 * Covers M08-S01, S20, S21, S23, M31-S01 to S03 and the signed url lifetime review (L-3).
 */

let stack: RealHlsStack | undefined;

/** The edge accepts a url for 30 seconds past its expiry (clock skew), so wait past ttl plus skew. */
const SKEW_WAIT_MS = 36_000;

test.afterEach(async () => {
  await stack?.stop();
  stack = undefined;
});

const time = (page: Page) => page.evaluate(() => document.querySelector('video')?.currentTime ?? 0);
const hasText = (page: Page, text: string) =>
  page.evaluate((t) => document.body.innerText.includes(t), text);

async function open(page: Page, s: RealHlsStack) {
  await page.goto(s.appUrl);
  const h264 = await page.evaluate(() =>
    MediaSource.isTypeSupported('video/mp4; codecs="avc1.4d401e"'),
  );
  test.skip(!h264, 'this browser has no H.264, set E2E_CHROMIUM_PATH to Chrome');
}

async function expectPlaying(page: Page, after = 1.5) {
  await expect.poll(() => time(page), { timeout: 30_000 }).toBeGreaterThan(after);
}

test('plays AES-128 HLS through the key route and the edge worker', async ({ page }) => {
  stack = await startRealHlsStack({ clipSeconds: 30 });
  const edge: Array<{ status: number; auth: boolean; cookie: boolean; cors: string | null }> = [];
  page.on('response', async (r) => {
    if (!r.url().startsWith(stack!.edgeUrl)) return;
    const h = await r.request().allHeaders();
    edge.push({
      status: r.status(),
      auth: 'authorization' in h,
      cookie: 'cookie' in h,
      cors: r.headers()['access-control-allow-origin'] ?? null,
    });
  });
  await open(page, stack);
  await expectPlaying(page);

  const frames = await page.evaluate(
    () => document.querySelector('video')!.getVideoPlaybackQuality().totalVideoFrames,
  );
  expect(frames).toBeGreaterThan(10);

  // The key route got the bearer token and nothing else was needed.
  const keys = stack.requests.filter((r) => r.path.startsWith('/api/hls/keys/'));
  expect(keys.length).toBeGreaterThanOrEqual(1);
  expect(keys.every((k) => k.status === 200 && k.hasBearer)).toBe(true);
  expect(stack.requests.filter((r) => r.path.endsWith('/session'))).toHaveLength(1);

  // Segments came from the other origin with no custom headers, with CORS for the app origin only.
  expect(edge.length).toBeGreaterThan(0);
  expect(edge.every((e) => e.status === 200 && !e.auth && !e.cookie)).toBe(true);
  expect(edge.every((e) => e.cors === stack!.appUrl)).toBe(true);

  // What is stored is ciphertext, not MPEG-TS: it only plays because the key was fetched and applied.
  const first = await stack.readSegment((await stack.segmentKeys())[0]!);
  expect(first[0] !== 0x47 || first[188] !== 0x47).toBe(true);
});

test('the key route refuses a missing or foreign token and never allows caching', async ({
  page,
  request,
}) => {
  stack = await startRealHlsStack({ clipSeconds: 8, heights: [360] });
  const origin = stack.appUrl;
  const session = await request.post(`${origin}/api/play/${stack.videoId}/session`, {
    data: { profileId: 'prof-1' },
  });
  const { token } = (await session.json()) as { token: string };
  const ok = await request.get(`${origin}/api/hls/keys/${stack.videoId}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  expect(ok.status()).toBe(200);
  expect(ok.headers()['cache-control']).toBe('private, no-store');
  expect((await ok.body()).length).toBe(16);
  expect(Buffer.from(await ok.body()).equals(Buffer.from(stack.key))).toBe(true);
  expect((await request.get(`${origin}/api/hls/keys/${stack.videoId}`)).status()).toBe(401);
  expect(
    (
      await request.get(`${origin}/api/hls/keys/0194f1d2-0000-7000-8000-000000000000`, {
        headers: { authorization: `Bearer ${token}` },
      })
    ).status(),
  ).toBe(403);
  await page.close();
});

test('a segment url that expired while the viewer waited is refreshed silently (L-3)', async ({
  page,
}) => {
  stack = await startRealHlsStack({ clipSeconds: 90, segmentTtlSeconds: 4 });
  const statuses: number[] = [];
  page.on('response', (r) => {
    if (r.url().startsWith(stack!.edgeUrl)) statuses.push(r.status());
  });
  await open(page, stack);
  await expectPlaying(page);
  await page.evaluate(() => document.querySelector('video')!.pause());
  await page.waitForTimeout(SKEW_WAIT_MS); // every url issued with the playlist is now expired
  const sessionsBefore = stack.requests.filter((r) => r.path.endsWith('/session')).length;
  await page.evaluate(() => {
    const v = document.querySelector('video')!;
    v.currentTime = 70; // far beyond what was buffered
    void v.play();
  });
  await expect.poll(() => time(page), { timeout: 40_000 }).toBeGreaterThan(71);
  expect(statuses).toContain(403);
  expect(stack.requests.filter((r) => r.path.endsWith('/session')).length).toBeGreaterThan(
    sessionsBefore,
  );
  expect(await hasText(page, 'Connection lost')).toBe(false);
});

test('an unpublished video stops with the removed message when the refresh is refused (M08-S23)', async ({
  page,
}) => {
  stack = await startRealHlsStack({ clipSeconds: 90, segmentTtlSeconds: 4 });
  await open(page, stack);
  await expectPlaying(page);
  await page.evaluate(() => document.querySelector('video')!.pause());
  await page.waitForTimeout(SKEW_WAIT_MS);
  stack.state.published = false;
  await page.evaluate(() => {
    const v = document.querySelector('video')!;
    v.currentTime = 70;
    void v.play();
  });
  await expect
    .poll(() => hasText(page, 'This video is no longer available'), { timeout: 40_000 })
    .toBe(true);
});

test('seeking around does not trip the key rate limit (M08-S21 edge, M31-S02)', async ({
  page,
}) => {
  stack = await startRealHlsStack({ clipSeconds: 90 });
  await open(page, stack);
  await expectPlaying(page);
  for (const at of [60, 10, 75, 30, 5, 80, 45, 20, 65, 15]) {
    await page.evaluate((t) => {
      document.querySelector('video')!.currentTime = t;
    }, at);
    await page.waitForTimeout(700);
  }
  await expectPlaying(page, 1);
  const keys = stack.requests.filter((r) => r.path.startsWith('/api/hls/keys/'));
  expect(keys.some((k) => k.status === 429)).toBe(false);
  expect(keys.length).toBeLessThanOrEqual(10);
  test
    .info()
    .annotations.push({ type: 'key requests during 10 seeks', description: String(keys.length) });
});

test('shows the volume controls for a video with sound and hides them for a silent one (M08-S05)', async ({
  page,
}) => {
  stack = await startRealHlsStack({ clipSeconds: 10, heights: [360] });
  await open(page, stack);
  await expectPlaying(page, 0.5);
  await expect(page.getByRole('button', { name: /^(Mute|Unmute)$/ })).toHaveCount(1);
  await stack.stop();

  stack = await startRealHlsStack({ clipSeconds: 10, heights: [360], audio: false });
  await open(page, stack);
  await expectPlaying(page, 0.5);
  await expect(page.getByRole('button', { name: /^(Mute|Unmute)$/ })).toHaveCount(0);
});
