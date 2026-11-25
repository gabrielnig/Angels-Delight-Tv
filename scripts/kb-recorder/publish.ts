import { execFile } from 'node:child_process';
import { copyFile, mkdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { promisify } from 'node:util';
import type { Manifest } from './manifest';

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
