import { describe, expect, it } from 'vitest';
import { buildManifest, compareManifests, type ManifestEpisode } from './manifest';

const episode = (over: Partial<ManifestEpisode> = {}): ManifestEpisode => ({
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
        { height: 720, file: 'D02/desktop/D02-desktop.mp4', bytes: 2_000_000 },
        { height: 480, file: 'D02/desktop/D02-desktop-480.mp4', bytes: 900_000 },
      ],
      vtt: 'D02/desktop/D02-desktop.vtt',
      transcript: 'D02/desktop/D02-desktop.transcript.txt',
      chapters: 'D02/desktop/D02-desktop.chapters.vtt',
      poster: 'D02/desktop/D02-desktop.poster.jpg',
      width: 1280,
      height: 720,
      bytes: 2_000_000,
      durationMs: 90_000,
      shots: [
        {
          step: 2,
          file: 'D02/desktop/shots/D02-02-queue-desktop.webp',
          alt: 'The queue',
          bytes: 50_000,
        },
      ],
    },
  ],
  ...over,
});

describe('buildManifest', () => {
  it('has a schema number, the run, the time and the episodes sorted by id', () => {
    const m = buildManifest({
      run: 'r1',
      generatedAt: '2026-03-10T09:00:00.000Z',
      episodes: [episode({ id: 'W01' }), episode()],
    });
    expect(m.schema).toBe(1);
    expect(m.run).toBe('r1');
    expect(m.episodes.map((e) => e.id)).toEqual(['D02', 'W01']);
  });

  it('keeps every path relative with forward slashes', () => {
    const m = buildManifest({ run: 'r1', generatedAt: 'x', episodes: [episode()] });
    const text = JSON.stringify(m);
    expect(text).not.toMatch(/"\/|\\\\|[A-Za-z]:/);
  });

  it('refuses an absolute path, so a manifest never leaks a build machine folder', () => {
    const bad = episode();
    bad.profiles[0]!.video = '/home/build/D02.mp4';
    expect(() => buildManifest({ run: 'r1', generatedAt: 'x', episodes: [bad] })).toThrow(
      /relative/,
    );
  });
});

describe('compareManifests (nightly: duration within 10 percent)', () => {
  const m = (ms: number) =>
    buildManifest({
      run: 'r',
      generatedAt: 'x',
      episodes: [episode({ profiles: [{ ...episode().profiles[0]!, durationMs: ms }] })],
    });
  it('passes a small change and flags a big one', () => {
    expect(compareManifests(m(90_000), m(95_000))).toEqual([]);
    expect(compareManifests(m(90_000), m(120_000)).join()).toMatch(/D02 desktop.*33/);
  });
  it('flags an episode that disappeared and lists a new one as fine', () => {
    const prev = buildManifest({
      run: 'r',
      generatedAt: 'x',
      episodes: [episode(), episode({ id: 'D03' })],
    });
    const next = buildManifest({
      run: 'r',
      generatedAt: 'x',
      episodes: [episode(), episode({ id: 'D04' })],
    });
    expect(compareManifests(prev, next).join()).toMatch(/D03.*missing/);
    expect(compareManifests(prev, next).join()).not.toMatch(/D04/);
  });
});
