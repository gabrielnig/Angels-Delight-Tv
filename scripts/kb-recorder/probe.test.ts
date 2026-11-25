import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkProbe, probeVideo, type VideoProbe } from './probe';

const good: VideoProbe = {
  durationMs: 90_000,
  bytes: 2_000_000,
  width: 1280,
  height: 720,
  codec: 'h264',
  pixFmt: 'yuv420p',
  fps: 30,
  audioStreams: 0,
};
const limits = { minSeconds: 60, maxSeconds: 240, maxBytes: 5 * 1024 * 1024 };

describe('checkProbe', () => {
  it('accepts a 90 second silent H.264 video of the right size', () => {
    expect(checkProbe(good, limits, { width: 1280, height: 720 })).toEqual([]);
  });
  it.each([
    ['too short', { durationMs: 20_000 }, /shorter than 60 s/],
    ['too long', { durationMs: 300_000 }, /longer than 240 s/],
    ['too big', { bytes: 9 * 1024 * 1024 }, /5 MB/],
    ['has audio', { audioStreams: 1 }, /audio/],
    ['wrong codec', { codec: 'vp9' }, /h264/],
    ['wrong pixel format', { pixFmt: 'yuv444p' }, /yuv420p/],
    ['wrong size', { width: 640 }, /1280x720/],
  ])('rejects a video that is %s', (_n, patch, pattern) => {
    expect(checkProbe({ ...good, ...patch }, limits, { width: 1280, height: 720 }).join()).toMatch(
      pattern,
    );
  });
});

describe.skipIf(spawnSync('ffprobe', ['-version']).status !== 0)('probeVideo', () => {
  it('reads duration, size, codec, pixel format, fps and audio streams', async () => {
    const f = join(mkdtempSync(join(tmpdir(), 'kb-probe-')), 'a.mp4');
    execFileSync('ffmpeg', [
      '-v',
      'error',
      '-f',
      'lavfi',
      '-i',
      'testsrc2=size=320x240:rate=30',
      '-t',
      '2',
      '-pix_fmt',
      'yuv420p',
      '-c:v',
      'libx264',
      '-an',
      '-y',
      f,
    ]);
    const p = await probeVideo(f);
    expect(p).toMatchObject({
      width: 320,
      height: 240,
      codec: 'h264',
      pixFmt: 'yuv420p',
      audioStreams: 0,
      fps: 30,
    });
    expect(p.durationMs).toBeGreaterThan(1900);
    expect(p.bytes).toBeGreaterThan(1000);
  });
});
