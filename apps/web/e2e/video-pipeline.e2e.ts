import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { ACCOUNTS } from './support/accounts';

/**
 * The real pipeline, no fixtures: upload through the admin API, the worker encodes with ffmpeg, the fake transcriber
 * writes captions, staff approve and publish, then a viewer plays the result in the browser.
 *
 * Needs the stack from scripts/e2e-video-up.sh (web with PLAYBACK_TRANSPORT=http, the worker, Postgres) and
 * `E2E_VIDEO=1`. The video is H.264, so run with E2E_CHROMIUM_PATH=/opt/google/chrome/chrome.
 * See docs/lanes/K2-video-integration.md.
 */
test.skip(!process.env.E2E_VIDEO, 'set E2E_VIDEO=1 with the stack from scripts/e2e-video-up.sh');
test.use({
  launchOptions: process.env.E2E_CHROMIUM_PATH
    ? {
        executablePath: process.env.E2E_CHROMIUM_PATH,
        args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
      }
    : { args: ['--autoplay-policy=no-user-gesture-required'] },
});
test.describe.configure({ mode: 'serial', timeout: 300_000 });

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3111';
const sameOrigin = { origin: new URL(BASE).origin, 'content-type': 'application/json' };

function psql(sql: string): string {
  return execFileSync('psql', [process.env.E2E_DATABASE_ADMIN_URL as string, '-Atqc', sql], {
    encoding: 'utf8',
  }).trim();
}

async function json<T>(response: Awaited<ReturnType<APIRequestContext['get']>>): Promise<T> {
  const text = await response.text();
  expect(response.ok(), `${response.url()} answered ${response.status()}: ${text}`).toBe(true);
  return JSON.parse(text) as T;
}

async function adminSignIn(page: Page) {
  await page.goto('/admin/login');
  await page.getByLabel('Email').fill(ACCOUNTS.admin.email);
  await page.getByLabel('Password').fill(ACCOUNTS.admin.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/admin(?!\/login)/, { timeout: 30_000 });
}

test('upload, encode, caption, approve, publish and play', async ({ browser }) => {
  const work = mkdtempSync(join(tmpdir(), 'ad-e2e-'));
  const file = join(work, 'sample-lesson.mp4');
  execFileSync('ffmpeg', [
    '-hide_banner',
    '-loglevel',
    'error',
    '-y',
    '-f',
    'lavfi',
    '-i',
    'testsrc2=size=640x360:rate=24',
    '-f',
    'lavfi',
    '-i',
    'sine=frequency=440:sample_rate=44100',
    '-t',
    '8',
    '-c:v',
    'libx264',
    '-pix_fmt',
    'yuv420p',
    '-c:a',
    'aac',
    '-movflags',
    '+faststart',
    file,
  ]);
  const bytes = readFileSync(file);

  // Staff side.
  const adminContext = await browser.newContext({ baseURL: BASE });
  const admin = await adminContext.newPage();
  await adminSignIn(admin);
  const api = adminContext.request;

  const created = await json<{
    uploadId: string;
    videoId: string;
    totalParts: number;
    partSize: number;
  }>(
    await api.post('/api/admin/uploads', {
      headers: sameOrigin,
      data: {
        name: 'Sample lesson.mp4',
        size: bytes.length,
        type: 'video/mp4',
        fingerprint: `e2e-${Date.now()}-abcdef`,
      },
    }),
  );
  expect(created.totalParts).toBe(1);
  const { urls } = await json<{ urls: Record<string, string> }>(
    await api.post(`/api/admin/uploads/${created.uploadId}/parts`, {
      headers: sameOrigin,
      data: { partNumbers: [1] },
    }),
  );
  const put = await api.put(urls['1'] as string, { data: bytes });
  expect(put.status()).toBe(200);
  await json(
    await api.post(`/api/admin/uploads/${created.uploadId}/complete`, {
      headers: sameOrigin,
      data: {},
    }),
  );

  // The worker probes, encodes and thumbnails, then queues captions.
  type Encoding = {
    video: { status: string; failureMessage: string | null };
    jobs: { queue: string; status: string }[];
    renditions: { height: number; status: string }[];
  };
  await expect
    .poll(
      async () => {
        const status = await json<Encoding>(
          await api.get(`/api/admin/videos/${created.videoId}/encoding`),
        );
        expect(status.video.status, JSON.stringify(status)).not.toBe('failed');
        return status.video.status;
      },
      { timeout: 150_000, intervals: [2000] },
    )
    .toBe('ready');
  const done = await json<Encoding>(await api.get(`/api/admin/videos/${created.videoId}/encoding`));
  expect(done.renditions.length).toBeGreaterThan(0);
  expect(done.renditions.every((r) => r.status === 'ready')).toBe(true);

  // Captions from the fake transcriber wait for review, then staff approve.
  type Tracks = { tracks: { language: string; state: string; latestRevisionId: string | null }[] };
  await expect
    .poll(
      async () =>
        (await json<Tracks>(await api.get(`/api/admin/videos/${created.videoId}/captions`)))
          .tracks[0]?.state,
      { timeout: 90_000, intervals: [2000] },
    )
    .toBe('needs_review');
  const track = (await json<Tracks>(await api.get(`/api/admin/videos/${created.videoId}/captions`)))
    .tracks[0]!;
  await json(
    await api.post(`/api/admin/captions/${track.latestRevisionId}/approve`, {
      headers: sameOrigin,
      data: { confirmWarnings: true },
    }),
  );

  // The metadata screens are still fixtures (lane F), so the checklist items other than captions are set directly.
  const category = psql(
    "insert into categories (id, slug, name) values (gen_random_uuid(), 'e2e-' || extract(epoch from now())::bigint, 'Science ' || extract(epoch from now())::bigint) returning id",
  );
  const poster = psql(
    "insert into assets (purpose, status, mime) values ('thumbnail', 'ready', 'image/webp') returning id",
  );
  psql(
    `update videos set title = 'How Rain Is Made', description = 'Water goes up and comes down.', kids_safe = true, poster_asset_id = '${poster}' where id = '${created.videoId}'`,
  );
  psql(
    `insert into video_categories (video_id, category_id) values ('${created.videoId}', '${category}')`,
  );
  const published = await json<{ publishState: string }>(
    await api.post(`/api/admin/videos/${created.videoId}/publish`, {
      headers: sameOrigin,
      data: {},
    }),
  );
  expect(published.publishState).toBe('published');

  // Viewer side.
  const viewerContext = await browser.newContext({ baseURL: BASE });
  const viewer = await viewerContext.newPage();
  await viewer.goto('/sign-in');
  await viewer.getByLabel('Email').fill(ACCOUNTS.viewer.email);
  await viewer.getByLabel('Password', { exact: true }).fill(ACCOUNTS.viewer.password);
  await viewer.getByRole('button', { name: /^Sign in/ }).click();
  await expect(viewer).not.toHaveURL(/sign-in/, { timeout: 30_000 });

  const vapi = viewerContext.request;
  const existing = await json<{ profiles: { id: string }[] }>(await vapi.get('/api/profiles'));
  const profile =
    existing.profiles[0] ??
    (
      await json<{ profile: { id: string } }>(
        await vapi.post('/api/profiles', {
          headers: sameOrigin,
          data: { name: 'Grown up', avatarId: 'sun', isKids: false },
        }),
      )
    ).profile;
  await json(
    await vapi.post(`/api/profiles/${profile.id}/select`, { headers: sameOrigin, data: {} }),
  );

  await viewer.goto(`/watch/${created.videoId}`);
  await expect(viewer.getByRole('heading', { level: 1, name: 'How Rain Is Made' })).toBeVisible();
  await expect(viewer.getByRole('region', { name: /Video player/ })).toBeVisible();
  const currentTime = () =>
    viewer.evaluate(() => document.querySelector('video')?.currentTime ?? 0);
  await expect.poll(currentTime, { timeout: 40_000 }).toBeGreaterThan(1.5);

  // Captions are attached from the approved track.
  const cues = await viewer.evaluate(() =>
    Array.from(document.querySelector('video')?.textTracks ?? []).map(
      (t) => `${t.kind}:${t.language}`,
    ),
  );
  expect(cues.join(',')).toContain('en');

  // Progress reaches the server through the player's sink. Pause past the minimum position the service keeps.
  await expect.poll(currentTime, { timeout: 40_000 }).toBeGreaterThan(6);
  await viewer.evaluate(() => document.querySelector('video')?.pause());
  await expect
    .poll(() => psql(`select count(*) from watch_progress where video_id = '${created.videoId}'`), {
      timeout: 40_000,
    })
    .toBe('1');

  // A signed out browser gets nothing from the playback routes.
  const anon = await browser.newContext({ baseURL: BASE });
  const denied = await anon.request.post(`/api/play/${created.videoId}/session`, {
    headers: sameOrigin,
    data: { profileId: profile.id },
  });
  expect(denied.status()).toBe(401);
  const keyDenied = await anon.request.get(`/api/hls/keys/${created.videoId}`);
  expect(keyDenied.status()).toBe(401);

  await Promise.all([adminContext.close(), viewerContext.close(), anon.close()]);
  rmSync(work, { recursive: true, force: true });
});
