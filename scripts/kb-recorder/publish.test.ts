import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { execFileSync, spawnSync } from 'node:child_process';
import { newestEpisodes, publishRun, publishRuns, releaseFiles, videoIdOf } from './publish';
import type { Manifest } from './manifest';

const manifest: Manifest = {
  schema: 1,
  run: 'r1',
  generatedAt: 'x',
  episodes: [
    {
      id: 'D02',
      title: 'Upload one video',
      role: 'editor',
      path: 'daily',
      locale: 'en',
      profiles: [
        {
          profile: 'desktop',
          video: 'D02/desktop/D02-desktop.mp4',
          renditions: [
            { height: 720, file: 'D02/desktop/D02-desktop.mp4', bytes: 1 },
            { height: 480, file: 'D02/desktop/D02-desktop-480.mp4', bytes: 1 },
          ],
          vtt: 'D02/desktop/D02-desktop.vtt',
          transcript: 'D02/desktop/D02-desktop.transcript.txt',
          chapters: 'D02/desktop/D02-desktop.chapters.vtt',
          poster: 'D02/desktop/D02-desktop.poster.jpg',
          width: 1280,
          height: 720,
          bytes: 1,
          durationMs: 1000,
          shots: [],
        },
        {
          profile: 'mobile',
          video: 'D02/mobile/D02-mobile.mp4',
          renditions: [{ height: 844, file: 'D02/mobile/D02-mobile.mp4', bytes: 1 }],
          vtt: 'D02/mobile/D02-mobile.vtt',
          transcript: 'D02/mobile/D02-mobile.transcript.txt',
          chapters: 'D02/mobile/D02-mobile.chapters.vtt',
          poster: 'D02/mobile/D02-mobile.poster.jpg',
          width: 390,
          height: 844,
          bytes: 1,
          durationMs: 1000,
          shots: [],
        },
      ],
    },
  ],
};

describe('release layout (what the platform media route reads)', () => {
  it('names the video id from the article id', () => {
    expect(videoIdOf('D02')).toBe('VD02');
  });

  it('maps files to help/<release>/<VIDEO_ID>/ with the 720, 480, poster, captions and phone names', () => {
    const files = releaseFiles(manifest, 'v1.0.0');
    const dests = files.map((f) => f.dest).sort();
    expect(dests).toEqual([
      'help/v1.0.0/VD02/VD02-480.mp4',
      'help/v1.0.0/VD02/VD02-720.mp4',
      'help/v1.0.0/VD02/VD02-captions.vtt',
      'help/v1.0.0/VD02/VD02-chapters.vtt',
      'help/v1.0.0/VD02/VD02-phone-720.mp4',
      'help/v1.0.0/VD02/VD02-phone-captions.vtt',
      'help/v1.0.0/VD02/VD02-poster.webp',
      'help/v1.0.0/VD02/VD02-transcript.txt',
    ]);
    expect(files.find((f) => f.dest.endsWith('VD02-720.mp4'))!.source).toBe(
      'D02/desktop/D02-desktop.mp4',
    );
  });

  it('refuses a release name that is not a plain folder name', () => {
    expect(() => releaseFiles(manifest, '../x')).toThrow(/release/);
    expect(() => releaseFiles(manifest, 'a b')).toThrow(/release/);
  });
});

describe.skipIf(spawnSync('ffmpeg', ['-version']).status !== 0)('publishRun', () => {
  it('copies every file into the release folder and converts the poster to WebP', async () => {
    const run = mkdtempSync(join(tmpdir(), 'kb-run-'));
    const dest = mkdtempSync(join(tmpdir(), 'kb-dest-'));
    for (const f of releaseFiles(manifest, 'v1')) {
      mkdirSync(join(run, f.source, '..'), { recursive: true });
      if (f.source.endsWith('.jpg')) {
        execFileSync('ffmpeg', [
          '-v',
          'error',
          '-f',
          'lavfi',
          '-i',
          'color=c=blue:s=64x36',
          '-frames:v',
          '1',
          '-y',
          join(run, f.source),
        ]);
      } else {
        writeFileSync(join(run, f.source), f.source);
      }
    }
    const n = await publishRun({ run, manifest, release: 'v1', dest });
    expect(n).toBe(8);
    expect(readFileSync(join(dest, 'help/v1/VD02/VD02-720.mp4'), 'utf8')).toBe(
      'D02/desktop/D02-desktop.mp4',
    );
    expect(existsSync(join(dest, 'help/v1/VD02/VD02-phone-720.mp4'))).toBe(true);
    expect(
      readFileSync(join(dest, 'help/v1/VD02/VD02-poster.webp')).subarray(8, 12).toString(),
    ).toBe('WEBP');
  });
});

describe('newestEpisodes (merging several run folders)', () => {
  const ep = (id: string, file: string) => ({
    ...manifest.episodes[0]!,
    id,
    profiles: manifest.episodes[0]!.profiles.map((p) => ({ ...p, video: file })),
  });
  const old = {
    dir: '/runs/a',
    manifest: {
      ...manifest,
      generatedAt: '2026-11-25T08:00:00Z',
      episodes: [ep('D02', 'old.mp4'), ep('D03', 'old3.mp4')],
    },
  };
  const fresh = {
    dir: '/runs/b',
    manifest: {
      ...manifest,
      generatedAt: '2026-11-25T18:00:00Z',
      episodes: [ep('D02', 'new.mp4')],
    },
  };

  it('takes each episode from the newest run that has it', () => {
    const picked = newestEpisodes([old, fresh], () => true);
    expect(picked.map((p) => `${p.episode.id}:${p.dir}`).sort()).toEqual([
      'D02:/runs/b',
      'D03:/runs/a',
    ]);
  });

  it('skips a run whose files are gone and falls back to the older one', () => {
    const picked = newestEpisodes([old, fresh], (dir) => dir !== '/runs/b');
    expect(picked.find((p) => p.episode.id === 'D02')!.dir).toBe('/runs/a');
  });

  it('keeps only the wanted ids', () => {
    expect(newestEpisodes([old, fresh], () => true, ['D03']).map((p) => p.episode.id)).toEqual([
      'D03',
    ]);
  });
});

describe.skipIf(spawnSync('ffmpeg', ['-version']).status !== 0)('publishRuns', () => {
  it('writes one release from two run folders', async () => {
    const mk = (id: string) => {
      const run = mkdtempSync(join(tmpdir(), 'kb-run-'));
      const m: Manifest = {
        ...manifest,
        episodes: [
          {
            ...manifest.episodes[0]!,
            id,
            profiles: manifest.episodes[0]!.profiles.map((p) => ({
              ...p,
              video: p.video.replace('D02', id),
              renditions: p.renditions.map((r) => ({ ...r, file: r.file.replace('D02', id) })),
              vtt: p.vtt.replace('D02', id),
              transcript: p.transcript.replace('D02', id),
              chapters: p.chapters.replace('D02', id),
              poster: p.poster.replace('D02', id),
            })),
          },
        ],
      };
      for (const f of releaseFiles(m, 'x')) {
        mkdirSync(join(run, f.source, '..'), { recursive: true });
        if (f.source.endsWith('.jpg'))
          execFileSync('ffmpeg', [
            '-v',
            'error',
            '-f',
            'lavfi',
            '-i',
            'color=c=red:s=64x36',
            '-frames:v',
            '1',
            '-y',
            join(run, f.source),
          ]);
        else writeFileSync(join(run, f.source), f.source);
      }
      return { dir: run, manifest: m };
    };
    const dest = mkdtempSync(join(tmpdir(), 'kb-dest-'));
    const n = await publishRuns({ runs: [mk('D02'), mk('D03')], release: 'v1', dest });
    expect(n).toBe(16);
    expect(existsSync(join(dest, 'help/v1/VD02/VD02-720.mp4'))).toBe(true);
    expect(existsSync(join(dest, 'help/v1/VD03/VD03-480.mp4'))).toBe(true);
  });
});
