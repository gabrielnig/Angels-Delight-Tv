import { mkdir } from 'node:fs/promises';
import { chromium, type BrowserContextOptions } from '@playwright/test';
import type { StepTiming } from './captions';
import { readingTimeMs } from './captions';
import type { Episode } from './episode';
import { signInAs } from './helpers';
import { overlayInitScript } from './overlay';
import type { Profile } from './profiles';
import { Session } from './session';
import { shotFileName } from './steps-block';

export interface PlayOptions {
  baseURL: string;
  /** Directory for the raw video. Without it nothing is recorded. */
  videoDir?: string;
  /** Directory for screenshots as PNG. Without it no shot is taken. */
  shotsDir: string | null;
  pace: number;
  /** Locator check: no reading time padding, no captions pacing. Used by CI and the fact checker. */
  check?: boolean;
  /** Fixed browser clock (epoch ms) so dates in the capture never change between runs. */
  clockMs?: number;
}

export interface PlayResult {
  timings: StepTiming[];
  totalMs: number;
  videoPath: string | null;
  shots: Array<{ step: number; name: string; file: string }>;
}

export class StepFailure extends Error {
  constructor(
    readonly episodeId: string,
    readonly step: number,
    readonly caption: string,
    cause: unknown,
  ) {
    super(
      `Episode ${episodeId} failed at step ${step} ("${caption}"): ${cause instanceof Error ? cause.message : String(cause)}`,
    );
  }
}

const baseContext = (profile: Profile, baseURL: string): BrowserContextOptions => ({
  baseURL,
  viewport: { width: profile.width, height: profile.height },
  deviceScaleFactor: 1,
  // The app sends a strict style-src CSP; the overlay needs inline styles. Recording only, never point this at production.
  bypassCSP: true,
  isMobile: profile.mobile,
  hasTouch: false,
  locale: 'en-GB',
  timezoneId: 'Africa/Lagos',
  colorScheme: 'light',
});

/** Plays one episode in a fresh browser. The role is signed in first, off camera, so the video starts on the task. */
export async function playEpisode(
  episode: Episode,
  profile: Profile,
  o: PlayOptions,
): Promise<PlayResult> {
  const browser = await chromium.launch({ executablePath: process.env.E2E_CHROMIUM_PATH });
  try {
    const storageState = await signInOffCamera(browser, episode, profile, o);
    const context = await browser.newContext({
      ...baseContext(profile, o.baseURL),
      ...(storageState ? { storageState } : {}),
      ...(o.videoDir
        ? {
            recordVideo: {
              dir: o.videoDir,
              size: { width: profile.width, height: profile.height },
            },
          }
        : {}),
    });
    await context.addInitScript({ content: overlayInitScript({ touch: profile.mobile }) });
    // The storage notice would sit on top of every screen. Mark it as already dismissed (key from lib/consent/notice.ts).
    await context.addInitScript({
      content: `try { localStorage.setItem('ad:notice:v1', JSON.stringify({ version: 1, at: ${(o.clockMs ?? Date.now()) - 86_400_000} })); } catch (e) {}`,
    });
    if (o.clockMs !== undefined) await context.clock.setFixedTime(o.clockMs);
    const page = await context.newPage();
    const t0 = Date.now();
    const session = new Session(page, profile, o.shotsDir, o.pace);
    const timings: StepTiming[] = [];
    const shots: PlayResult['shots'] = [];
    if (o.shotsDir) await mkdir(o.shotsDir, { recursive: true });
    if (episode.role !== 'none') await session.goto(episode.start ?? '/admin');
    let i = 0;
    for (const step of episode.steps) {
      i += 1;
      const startMs = Date.now() - t0;
      session.lastTarget = null;
      try {
        await step.run(session);
        if (step.shot && o.shotsDir) {
          const marks = step.shot.marks.map((m) => ({ target: m.target(session), label: m.label }));
          const file = shotFileName(episode.id, i, step.shot.name, profile.name).replace(
            /\.webp$/,
            '.png',
          );
          await session.shot(file.replace(/\.png$/, ''), marks);
          shots.push({ step: i, name: step.shot.name, file });
        }
      } catch (e) {
        throw new StepFailure(episode.id, i, step.caption, e);
      }
      if (!o.check) {
        const wanted = readingTimeMs(step.caption) + 300 + (step.holdMs ?? 600);
        const spent = Date.now() - t0 - startMs;
        if (spent < wanted * o.pace) await session.pause(wanted - spent / o.pace);
      }
      timings.push({
        caption: step.caption,
        startMs,
        endMs: Date.now() - t0,
        position: step.captionAt ?? session.captionSide(),
      });
    }
    if (!o.check) await session.pause(1200);
    const totalMs = Date.now() - t0;
    const video = page.video();
    await context.close();
    const videoPath = video ? await video.path() : null;
    return { timings, totalMs, videoPath, shots };
  } finally {
    await browser.close();
  }
}

async function signInOffCamera(
  browser: Awaited<ReturnType<typeof chromium.launch>>,
  episode: Episode,
  profile: Profile,
  o: PlayOptions,
) {
  if (episode.role === 'none') return null;
  const ctx = await browser.newContext(baseContext(profile, o.baseURL));
  try {
    const page = await ctx.newPage();
    await signInAs(new Session(page, profile, null, 0.2), episode.role);
    return await ctx.storageState();
  } finally {
    await ctx.close();
  }
}
