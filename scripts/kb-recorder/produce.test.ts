import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { produceOutputs } from './produce';

const hasFfmpeg = spawnSync('ffmpeg', ['-version']).status === 0;

const probe = (file: string) =>
  JSON.parse(
    execFileSync('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', file], {
      encoding: 'utf8',
    }),
  ) as {
    streams: Array<{ codec_type: string; codec_name: string; width?: number }>;
    format: { duration: string };
  };

describe.skipIf(!hasFfmpeg)('produceOutputs', () => {
  const dir = mkdtempSync(join(tmpdir(), 'kb-produce-'));
  const raw = join(dir, 'raw.webm');
  execFileSync('ffmpeg', [
    '-v',
    'error',
    '-f',
    'lavfi',
    '-i',
    'testsrc2=size=1280x720:rate=25',
    '-t',
    '14',
    '-c:v',
    'libvpx-vp9',
    '-b:v',
    '300k',
    '-y',
    raw,
  ]);

  it('writes the mp4, vtt, ass, transcript and chapters, cuts a skipped wait and adds the two cards', async () => {
    const out = await produceOutputs({
      id: 'T01',
      title: 'Test episode',
      audience: 'Editors',
      profile: {
        name: 'desktop',
        width: 1280,
        height: 720,
        mobile: false,
        captionFontSize: 34,
        captionMarginX: 96,
        captionMarginV: 44,
      },
      raw,
      outDir: dir,
      totalMs: 14_000,
      next: 'T02 The next one',
      skips: [{ startMs: 6000, endMs: 10_000 }],
      timings: [
        {
          caption: 'Choose Videos in the side menu.',
          startMs: 500,
          endMs: 4000,
          pointer: 'Videos',
          chapter: 'Find it',
        },
        { caption: 'Wait for the upload.', startMs: 4000, endMs: 12_000 },
      ],
    });
    // 14 s minus 4 s skipped, plus 3 s title card and 3 s end card.
    const info = probe(out.mp4);
    expect(Number(info.format.duration)).toBeGreaterThan(15.5);
    expect(Number(info.format.duration)).toBeLessThan(16.6);
    expect(info.streams.map((s) => s.codec_type)).toEqual(['video']);
    expect(info.streams[0]!.codec_name).toBe('h264');
    expect(info.streams[0]!.width).toBe(1280);
    for (const f of [out.vtt, out.ass, out.transcript, out.chapters])
      expect(existsSync(f)).toBe(true);
    expect(readFileSync(out.vtt, 'utf8')).toMatch(
      /00:00:03\.\d{3} --> .*\nChoose Videos in the side menu\./,
    );
    expect(readFileSync(out.transcript, 'utf8')).toContain('The pointer moves to Videos.');
    expect(readFileSync(out.chapters, 'utf8')).toContain('Find it');
    expect(out.durationMs).toBeGreaterThan(15_500);
    expect(out.cueProblems).toEqual([]);
  }, 60_000);
});
