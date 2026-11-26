import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { copyFile, mkdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { promisify } from 'node:util';
import type { Manifest, ManifestEpisode } from './manifest';

const exec = promisify(execFile);

/** The video id of an article id: D02 becomes VD02 (plan section 3.1). */
export const videoIdOf = (articleId: string) => `V${articleId}`;

export interface ReleaseFile {
  /** Path relative to the run folder. */
  source: string;
  /** Path under the media root: `help/<release>/<VIDEO_ID>/<file>`, the layout the help media route reads. */
  dest: string;
  /** The poster is converted from JPEG to WebP on the way. */
  convert?: 'poster';
}

/**
 * Where each file of a run goes in a media release (D-360): `<VIDEO_ID>-720.mp4`, `-480.mp4`, `-poster.webp`,
 * `-captions.vtt`, `-chapters.vtt`, `-transcript.txt` and the phone set (`-phone-720.mp4`, `-phone-captions.vtt`).
 */
export function releaseFiles(manifest: Manifest, release: string): ReleaseFile[] {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(release) || release.includes('..')) {
    throw new Error(`The release "${release}" must be a plain folder name such as v1.0.0`);
  }
  const out: ReleaseFile[] = [];
  for (const e of manifest.episodes) {
    const vid = videoIdOf(e.id);
    const base = `help/${release}/${vid}`;
    for (const p of e.profiles) {
      if (p.profile === 'desktop') {
        for (const r of p.renditions)
          out.push({ source: r.file, dest: `${base}/${vid}-${r.height}.mp4` });
        out.push({ source: p.vtt, dest: `${base}/${vid}-captions.vtt` });
        out.push({ source: p.chapters, dest: `${base}/${vid}-chapters.vtt` });
        out.push({ source: p.transcript, dest: `${base}/${vid}-transcript.txt` });
        out.push({ source: p.poster, dest: `${base}/${vid}-poster.webp`, convert: 'poster' });
      } else {
        out.push({ source: p.video, dest: `${base}/${vid}-phone-720.mp4` });
        out.push({ source: p.vtt, dest: `${base}/${vid}-phone-captions.vtt` });
      }
    }
  }
  return out;
}

/** Copies a run into `<dest>/help/<release>/...`. Uploading that folder to the media bucket is an operations step. */
export async function publishRun(o: {
  run: string;
  manifest: Manifest;
  release: string;
  dest: string;
}): Promise<number> {
  const files = releaseFiles(o.manifest, o.release);
  for (const f of files) {
    const from = resolve(o.run, f.source);
    const to = resolve(o.dest, f.dest);
    await mkdir(dirname(to), { recursive: true });
    if (f.convert === 'poster') {
      await exec('ffmpeg', [
        '-y',
        '-v',
        'error',
        '-i',
        from,
        '-map_metadata',
        '-1',
        '-c:v',
        'libwebp',
        '-quality',
        '82',
        to,
      ]);
    } else {
      await copyFile(from, to);
    }
  }
  return files.length;
}

export const releaseRoot = (dest: string, release: string) => join(dest, 'help', release);

export interface RunFolder {
  dir: string;
  manifest: Manifest;
}

/**
 * Merges several run folders: each episode comes from the newest run (by `generatedAt`) that has it.
 * `hasFiles(dir, episode)` lets the caller skip a run whose video files were deleted. `only` keeps listed ids.
 */
export function newestEpisodes(
  runs: RunFolder[],
  hasFiles: (dir: string, episode: ManifestEpisode) => boolean,
  only?: string[],
): Array<{ dir: string; episode: ManifestEpisode }> {
  const newestFirst = [...runs].sort((a, b) =>
    b.manifest.generatedAt.localeCompare(a.manifest.generatedAt),
  );
  const picked = new Map<string, { dir: string; episode: ManifestEpisode }>();
  for (const run of newestFirst) {
    for (const episode of run.manifest.episodes) {
      if (only && !only.includes(episode.id)) continue;
      if (picked.has(episode.id) || !hasFiles(run.dir, episode)) continue;
      picked.set(episode.id, { dir: run.dir, episode });
    }
  }
  return [...picked.values()];
}

/** Writes one release folder from several run folders (newest recording per episode). Returns the file count. */
export async function publishRuns(o: {
  runs: RunFolder[];
  release: string;
  dest: string;
  only?: string[];
}): Promise<number> {
  const hasFiles = (dir: string, e: ManifestEpisode) =>
    e.profiles.every((p) => p.renditions.every((r) => existsSync(resolve(dir, r.file))));
  let n = 0;
  for (const { dir, episode } of newestEpisodes(o.runs, hasFiles, o.only)) {
    const manifest: Manifest = { schema: 1, run: dir, generatedAt: '', episodes: [episode] };
    n += await publishRun({ run: dir, manifest, release: o.release, dest: o.dest });
  }
  return n;
}
