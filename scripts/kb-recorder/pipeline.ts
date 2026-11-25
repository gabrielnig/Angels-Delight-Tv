import { execFile } from 'node:child_process';
import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { join, relative, resolve, sep } from 'node:path';
import { promisify } from 'node:util';
import { audienceOf, type Episode } from './episode';
import { replaceDir } from './fs-swap';
import {
  buildManifest,
  type Manifest,
  type ManifestEpisode,
  type ManifestProfile,
} from './manifest';
import { checkProbe, probeVideo, type VideoLimits } from './probe';
import { produceOutputs } from './produce';
import type { Profile } from './profiles';
import { resetDemo } from './demo/client';
import { playEpisode, StepFailure } from './runner';
import { pathOf } from './select';

const exec = promisify(execFile);

export interface PipelineOptions {
  baseURL: string;
  out: string;
  run: string;
  pace: number;
  warm: boolean;
  reset: boolean;
  shots: boolean;
  limits: VideoLimits;
}

const SHOT_SCALE: Record<Profile['name'], number> = { desktop: 2, mobile: 3 };

async function fresh(o: PipelineOptions): Promise<number | undefined> {
  return o.reset ? (await resetDemo(o.baseURL)).now : undefined;
}

const posix = (p: string) => p.split(sep).join('/');

/**
 * Records one episode at one profile into `<out>/<run>/<id>/<profile>/`: a warm up pass, a screenshot pass at the
 * screenshot scale, the video pass, the outputs, a poster, a 480p copy on desktop and the ffprobe checks. The work
 * happens in a temporary folder and replaces the published one only when every check passed.
 */
export async function recordProfile(
  episode: Episode,
  profile: Profile,
  o: PipelineOptions,
): Promise<{ entry: ManifestProfile; problems: string[]; timings: Record<string, number> }> {
  const root = resolve(o.out, o.run);
  const final = join(root, episode.id, profile.name);
  const work = `${final}.work`;
  await rm(work, { recursive: true, force: true });
  await mkdir(work, { recursive: true });
  const t = Date.now();
  const timings: Record<string, number> = {};
  try {
    if (o.warm) {
      // Next dev compiles each route on first visit, which shows up as blank frames. One silent pass warms them.
      await playEpisode(episode, profile, {
        baseURL: o.baseURL,
        shotsDir: null,
        pace: 0.2,
        check: true,
        clockMs: await fresh(o),
      });
      timings.warmMs = Date.now() - t;
    }
    const shotsDir = join(work, 'shots');
    let shotList: Array<{
      step: number;
      file: string;
      alt: string;
      masks: Array<{ x: number; y: number; width: number; height: number }>;
    }> = [];
    if (o.shots && episode.steps.some((s) => s.shot)) {
      const s0 = Date.now();
      const r = await playEpisode(episode, profile, {
        baseURL: o.baseURL,
        shotsDir,
        pace: 0.4,
        check: true,
        scale: SHOT_SCALE[profile.name],
        clockMs: await fresh(o),
      });
      shotList = r.shots;
      timings.shotsMs = Date.now() - s0;
    }
    const r0 = Date.now();
    const rec = await playEpisode(episode, profile, {
      baseURL: o.baseURL,
      videoDir: join(work, 'tmp'),
      shotsDir: null,
      pace: o.pace,
      clockMs: await fresh(o),
    });
    timings.recordMs = Date.now() - r0;
    if (!rec.videoPath) throw new Error('No video was produced');
    const raw = join(work, `${episode.id}-${profile.name}.raw.webm`);
    await rename(rec.videoPath, raw);
    await rm(join(work, 'tmp'), { recursive: true, force: true });

    const b0 = Date.now();
    const out = await produceOutputs({
      id: episode.id,
      title: episode.title,
      audience: audienceOf(episode.role),
      profile,
      raw,
      outDir: work,
      totalMs: rec.totalMs,
      timings: rec.timings,
      skips: rec.skips,
      next: episode.next,
    });
    timings.burnMs = Date.now() - b0;

    const poster = join(work, `${episode.id}-${profile.name}.poster.jpg`);
    await exec('ffmpeg', [
      '-y',
      '-v',
      'error',
      '-ss',
      '3.4',
      '-i',
      out.mp4,
      '-frames:v',
      '1',
      '-q:v',
      '3',
      poster,
    ]);
    const renditions = [
      { height: profile.height, file: out.mp4, bytes: (await stat(out.mp4)).size },
    ];
    if (!profile.mobile) {
      const small = join(work, `${episode.id}-${profile.name}-480.mp4`);
      await exec('ffmpeg', [
        '-y',
        '-v',
        'error',
        '-i',
        out.mp4,
        '-vf',
        'scale=-2:480',
        '-c:v',
        'libx264',
        '-preset',
        'medium',
        '-crf',
        '24',
        '-pix_fmt',
        'yuv420p',
        '-movflags',
        '+faststart',
        '-an',
        small,
      ]);
      renditions.push({ height: 480, file: small, bytes: (await stat(small)).size });
    }

    const probe = await probeVideo(out.mp4);
    const problems = [
      ...checkProbe(probe, o.limits, { width: profile.width, height: profile.height }),
    ];
    if (o.pace >= 1) problems.push(...out.cueProblems);

    const shots = await Promise.all(
      shotList.map(async (s) => ({
        step: s.step,
        alt: s.alt,
        file: s.file,
        masks: s.masks,
        bytes: (await stat(s.file)).size,
      })),
    );
    const meta = {
      episode: episode.id,
      profile: profile.name,
      viewport: `${profile.width}x${profile.height}`,
      ...timings,
      durationMs: probe.durationMs,
      bytes: probe.bytes,
      cues: out.cues.length,
      problems,
    };
    await writeFile(join(work, 'meta.json'), JSON.stringify(meta, null, 2) + '\n');
    if (problems.length) throw new CheckFailed(episode.id, profile.name, problems);

    await replaceDir(work, final);
    const rel = (file: string) => posix(relative(root, join(final, relative(work, file))));
    return {
      timings,
      problems,
      entry: {
        profile: profile.name,
        video: rel(out.mp4),
        renditions: renditions.map((r) => ({
          height: r.height,
          file: rel(r.file),
          bytes: r.bytes,
        })),
        vtt: rel(out.vtt),
        transcript: rel(out.transcript),
        chapters: rel(out.chapters),
        poster: rel(poster),
        width: probe.width,
        height: probe.height,
        bytes: probe.bytes,
        durationMs: probe.durationMs,
        shots: shots.map((s) => ({
          step: s.step,
          file: rel(s.file),
          alt: s.alt,
          bytes: s.bytes,
          ...(s.masks.length ? { masks: s.masks } : {}),
        })),
      },
    };
  } catch (e) {
    await rm(work, { recursive: true, force: true });
    throw e;
  }
}

export class CheckFailed extends Error {
  constructor(
    readonly episodeId: string,
    readonly profile: string,
    readonly problems: string[],
  ) {
    super(`${episodeId} ${profile} failed its checks: ${problems.join('; ')}`);
  }
}

/** Adds or replaces episodes in `<out>/<run>/manifest.json`, so a `--changed` run updates only what it recorded. */
export async function writeManifest(o: {
  out: string;
  run: string;
  episodes: ManifestEpisode[];
}): Promise<Manifest> {
  const file = resolve(o.out, o.run, 'manifest.json');
  let kept: ManifestEpisode[] = [];
  try {
    kept = (JSON.parse(await readFile(file, 'utf8')) as Manifest).episodes;
  } catch {
    // First run: no manifest yet.
  }
  const replaced = new Set(o.episodes.map((e) => e.id));
  const merged = buildManifest({
    run: o.run,
    generatedAt: new Date().toISOString(),
    episodes: [...kept.filter((e) => !replaced.has(e.id)), ...o.episodes],
  });
  await writeFile(file, JSON.stringify(merged, null, 2) + '\n');
  return merged;
}

export function manifestEntry(e: Episode, profiles: ManifestProfile[]): ManifestEpisode {
  return { id: e.id, title: e.title, role: e.role, path: pathOf(e), locale: 'en', profiles };
}

/** Plays an episode with no video and no pacing to prove every step still finds its control (CI and the fact checker). */
export async function verifyProfile(
  episode: Episode,
  profile: Profile,
  o: { baseURL: string; reset: boolean },
): Promise<{ ok: true } | { ok: false; step: number; caption: string; message: string }> {
  try {
    const clockMs = o.reset ? (await resetDemo(o.baseURL)).now : undefined;
    await playEpisode(episode, profile, {
      baseURL: o.baseURL,
      shotsDir: null,
      pace: 0.2,
      check: true,
      clockMs,
    });
    return { ok: true };
  } catch (e) {
    if (e instanceof StepFailure)
      return { ok: false, step: e.step, caption: e.caption, message: e.message };
    throw e;
  }
}
