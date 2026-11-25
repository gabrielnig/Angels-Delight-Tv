/**
 * KB recorder: records a captioned how-to of the admin screens.
 *   pnpm exec tsx scripts/kb-recorder/record.ts --episode home-preview --profile desktop,mobile --out .kb-out
 * See docs/spikes/kb-recording.md for the full setup.
 */
import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { burnCaptions } from './burn';
import { buildCues, toAss, toVtt, validateCues } from './captions';
import { validateEpisode } from './episode';
import { PROFILES, type Profile } from './profiles';
import { resetDemo } from './demo/client';
import { assertAllowedOrigin } from './demo/origin-guard';
import { loadEpisode } from './registry';
import { playEpisode } from './runner';

const { values } = parseArgs({
  options: {
    episode: { type: 'string' },
    profile: { type: 'string', default: 'desktop,mobile' },
    out: { type: 'string', default: '.kb-out' },
    'base-url': { type: 'string', default: process.env.KB_BASE_URL ?? 'http://localhost:3113' },
    'no-warm': { type: 'boolean', default: false },
    'no-reset': { type: 'boolean', default: false },
    pace: { type: 'string', default: '1' },
    run: { type: 'string', default: 'run1' },
  },
});

/** Resets the demo data so one episode never sees what another saved. Returns the pinned browser clock. */
async function freshDemo(baseURL: string): Promise<number | undefined> {
  if (values['no-reset']) return undefined;
  return (await resetDemo(baseURL)).now;
}

async function main() {
  if (!values.episode) throw new Error('Pass --episode <id>');
  const episode = await loadEpisode(values.episode);
  const problems = validateEpisode(episode);
  if (problems.length) throw new Error(`Episode ${episode.id}: ${problems.join('; ')}`);
  const baseURL = values['base-url']!;
  assertAllowedOrigin(baseURL);
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
      const clockMs = await freshDemo(baseURL);
      await playEpisode(episode, profile, { baseURL, shotsDir: null, pace: 0.2, clockMs });
    }
    const warmMs = Date.now() - started;
    const recStart = Date.now();
    const clockMs = await freshDemo(baseURL);
    const { timings, totalMs, videoPath } = await playEpisode(episode, profile, {
      baseURL,
      clockMs,
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
