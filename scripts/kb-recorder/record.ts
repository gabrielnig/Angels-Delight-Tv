/**
 * KB recorder: records a captioned how-to of the admin screens.
 *   pnpm exec tsx scripts/kb-recorder/record.ts --episode home-preview --profile desktop,mobile --out .kb-out
 * See docs/spikes/kb-recording.md for the full setup.
 */
import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { chromium } from '@playwright/test';
import { burnCaptions } from './burn';
import { buildCues, readingTimeMs, toAss, toVtt, validateCues, type StepTiming } from './captions';
import type { Episode } from './episode';
import { overlayInitScript } from './overlay';
import { PROFILES, Session, type Profile } from './session';

const { values } = parseArgs({
  options: {
    episode: { type: 'string' },
    profile: { type: 'string', default: 'desktop,mobile' },
    out: { type: 'string', default: '.kb-out' },
    'base-url': { type: 'string', default: process.env.KB_BASE_URL ?? 'http://localhost:3113' },
    'no-warm': { type: 'boolean', default: false },
    pace: { type: 'string', default: '1' },
    run: { type: 'string', default: 'run1' },
  },
});

async function loadEpisode(id: string): Promise<Episode> {
  const mod = (await import(`./episodes/${id}.ts`)) as { default: Episode };
  return mod.default;
}

async function playEpisode(
  episode: Episode,
  profile: Profile,
  o: { baseURL: string; videoDir?: string; shotsDir: string | null; pace: number },
) {
  const browser = await chromium.launch({ executablePath: process.env.E2E_CHROMIUM_PATH });
  const context = await browser.newContext({
    baseURL: o.baseURL,
    viewport: { width: profile.width, height: profile.height },
    deviceScaleFactor: 1,
    // The app sends a strict style-src CSP; the overlay needs inline styles. Recording only, never point this at production.
    bypassCSP: true,
    isMobile: profile.mobile,
    hasTouch: false,
    locale: 'en-GB',
    timezoneId: 'Africa/Lagos',
    colorScheme: 'light',
    ...(o.videoDir
      ? { recordVideo: { dir: o.videoDir, size: { width: profile.width, height: profile.height } } }
      : {}),
  });
  await context.addInitScript({ content: overlayInitScript({ touch: profile.mobile }) });
  // The storage notice would sit on top of every screen. Mark it as already dismissed (key from lib/consent/notice.ts).
  await context.addInitScript({
    content: `try { localStorage.setItem('ad:notice:v1', JSON.stringify({ version: 1, at: Date.now() })); } catch (e) {}`,
  });
  const page = await context.newPage();
  const t0 = Date.now();
  const session = new Session(page, profile, o.shotsDir, o.pace);
  const timings: StepTiming[] = [];
  await mkdir(o.shotsDir ?? '.', { recursive: true });
  let i = 0;
  for (const step of episode.steps) {
    i += 1;
    const startMs = Date.now() - t0;
    await step.run(session);
    if (step.shot && o.shotsDir) {
      const marks = step.shot.marks.map((m) => ({ target: m.target(session), label: m.label }));
      await session.shot(`${String(i).padStart(2, '0')}-${step.shot.name}`, marks);
    }
    const wanted =
      Math.max(step.caption ? readingTimeMs(step.caption) + 300 : 0, 0) + (step.holdMs ?? 600);
    const spent = Date.now() - t0 - startMs;
    if (spent < wanted * o.pace) await session.pause(wanted - spent / o.pace);
    timings.push({ caption: step.caption, startMs, endMs: Date.now() - t0 });
  }
  await session.pause(1200);
  const totalMs = Date.now() - t0;
  const video = page.video();
  await context.close();
  const videoPath = video ? await video.path() : null;
  await browser.close();
  return { timings, totalMs, videoPath };
}

async function main() {
  if (!values.episode) throw new Error('Pass --episode <id>');
  const episode = await loadEpisode(values.episode);
  const baseURL = values['base-url']!;
  const pace = Number(values.pace);
  const profiles = values.profile!.split(',').map((n) => {
    const p = PROFILES[n.trim() as Profile['name']];
    if (!p) throw new Error(`Unknown profile ${n}`);
    return p;
  });
  for (const profile of profiles) {
    const dir = resolve(values.out!, values.run!, episode.id, profile.name);
    await rm(dir, { recursive: true, force: true });
    await mkdir(dir, { recursive: true });
    const started = Date.now();
    if (!values['no-warm']) {
      // Next dev compiles each route on first visit, which shows up as blank frames. One silent pass warms them.
      await playEpisode(episode, profile, { baseURL, shotsDir: null, pace: 0.2 });
    }
    const warmMs = Date.now() - started;
    const recStart = Date.now();
    const { timings, totalMs, videoPath } = await playEpisode(episode, profile, {
      baseURL,
      videoDir: join(dir, 'tmp'),
      shotsDir: join(dir, 'shots'),
      pace,
    });
    if (!videoPath) throw new Error('No video was produced');
    const raw = join(dir, `${episode.id}-${profile.name}.raw.webm`);
    await rename(videoPath, raw);
    await rm(join(dir, 'tmp'), { recursive: true, force: true });
    const cues = buildCues(timings, { leadMs: 250, minMs: 1800 });
    const problems = validateCues(cues);
    if (problems.length) throw new Error(`Caption problems: ${problems.join('; ')}`);
    const vtt = join(dir, `${episode.id}-${profile.name}.vtt`);
    const ass = join(dir, `${episode.id}-${profile.name}.ass`);
    await writeFile(vtt, toVtt(cues));
    await writeFile(
      ass,
      toAss(cues, {
        width: profile.width,
        height: profile.height,
        fontSize: profile.captionFontSize,
        marginX: profile.captionMarginX,
        marginV: profile.captionMarginV,
        fontName: 'Inter',
      }),
    );
    const mp4 = join(dir, `${episode.id}-${profile.name}.mp4`);
    const burnStart = Date.now();
    await burnCaptions({ input: raw, ass, output: mp4 });
    const meta = {
      episode: episode.id,
      profile: profile.name,
      viewport: `${profile.width}x${profile.height}`,
      warmMs,
      recordMs: Date.now() - recStart,
      totalMs,
      burnMs: Date.now() - burnStart,
      cues: cues.length,
    };
    await writeFile(join(dir, 'meta.json'), JSON.stringify(meta, null, 2) + '\n');
    console.log(JSON.stringify(meta));
    console.log(`  ${mp4}\n  ${vtt}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
