import { describe, expect, it } from 'vitest';
import {
  PREVIEW_AUDIO_BITRATE,
  PREVIEW_CLIP_MAX_MS,
  PREVIEW_CLIP_MIN_MS,
  PREVIEW_CLIP_MS,
  PREVIEW_RETRY_CRF,
  PREVIEW_SWEEP_BATCH,
  clampClipMs,
  planPreview,
  previewArgs,
  previewKey,
  previewMaxBytes,
} from './preview';

describe('planPreview', () => {
  it('skips a video under 3 seconds', () => {
    expect(planPreview({ durationMs: 2900, mode: 'auto' })).toEqual({
      kind: 'skip',
      reason: 'The video is under 3 seconds',
    });
  });

  it('defaults to a 20 second clip and clamps the length setting to 6 to 30 seconds', () => {
    expect(PREVIEW_CLIP_MS).toBe(20_000);
    expect(PREVIEW_CLIP_MIN_MS).toBe(6000);
    expect(PREVIEW_CLIP_MAX_MS).toBe(30_000);
    expect(clampClipMs(1000)).toBe(6000);
    expect(clampClipMs(45_000)).toBe(30_000);
    expect(clampClipMs(18_400)).toBe(18_400);
    expect(clampClipMs(Number.NaN)).toBe(20_000);
  });

  it('uses the whole video up to the clip length and a clip length segment beyond it', () => {
    expect(planPreview({ durationMs: 20_000, mode: 'auto' })).toMatchObject({ startMs: 0, lengthMs: 20_000 });
    expect(planPreview({ durationMs: 12_000, mode: 'auto' })).toMatchObject({ startMs: 0, lengthMs: 12_000 });
    const long = planPreview({ durationMs: 28_000, mode: 'auto' });
    expect(long).toMatchObject({ kind: 'clip', lengthMs: 20_000 });
    if (long.kind === 'clip') for (const s of long.candidates) expect(s + 20_000).toBeLessThanOrEqual(28_000);
  });

  it('plays the whole of a 28 second video when the owner raises the length to 30 seconds', () => {
    expect(planPreview({ durationMs: 28_000, mode: 'auto', clipMs: 30_000 })).toMatchObject({
      startMs: 0,
      lengthMs: 28_000,
    });
  });

  it('uses the whole video from 3 seconds up to the clip length', () => {
    expect(planPreview({ durationMs: 3000, mode: 'auto' })).toEqual({
      kind: 'clip',
      startMs: 0,
      lengthMs: 3000,
      candidates: [0],
    });
    expect(planPreview({ durationMs: 8000, mode: 'auto' })).toMatchObject({ startMs: 0, lengthMs: 8000 });
  });

  it('keeps the 6 second behaviour when the setting is 6 seconds', () => {
    expect(planPreview({ durationMs: 10_000, mode: 'auto', clipMs: 6000 })).toMatchObject({ lengthMs: 6000 });
  });

  it('offers five candidates at 20, 35, 50, 65 and 80 percent minus 3 seconds', () => {
    const plan = planPreview({ durationMs: 600_000, mode: 'auto' });
    expect(plan).toMatchObject({ kind: 'clip', lengthMs: 20_000 });
    if (plan.kind !== 'clip') return;
    expect(plan.candidates).toEqual([117_000, 207_000, 297_000, 387_000, 477_000]);
  });

  it('clamps candidates to 1 second in and the clip length plus half a second before the end, without repeats', () => {
    const plan = planPreview({ durationMs: 9000, mode: 'auto', clipMs: 6000 });
    if (plan.kind !== 'clip') throw new Error('expected a clip');
    for (const start of plan.candidates) {
      expect(start).toBeGreaterThanOrEqual(1000);
      expect(start).toBeLessThanOrEqual(2500);
    }
    expect(new Set(plan.candidates).size).toBe(plan.candidates.length);
  });

  it('uses a picked start, rounded to 100 ms and kept inside the video', () => {
    expect(planPreview({ durationMs: 60_000, mode: 'picked', startMs: 12_345 })).toMatchObject({
      startMs: 12_300,
      candidates: [12_300],
    });
    expect(planPreview({ durationMs: 60_000, mode: 'picked', startMs: 59_000 })).toMatchObject({
      startMs: 40_000,
      lengthMs: 20_000,
    });
    expect(planPreview({ durationMs: 60_000, mode: 'picked', startMs: -5 })).toMatchObject({ startMs: 0 });
  });

  it('falls back to automatic when picked has no start', () => {
    const plan = planPreview({ durationMs: 60_000, mode: 'picked' });
    expect(plan.kind === 'clip' && plan.candidates.length).toBeGreaterThan(1);
  });
});

describe('previewArgs', () => {
  const args = previewArgs({
    input: '/scratch/source',
    container: 'mp4',
    startMs: 12_300,
    lengthMs: 20_000,
    output: '/scratch/preview.mp4',
    hasAudio: true,
  });

  it('seeks first, refuses non file protocols and writes a faststart H.264 file with low bitrate AAC', () => {
    expect(args.slice(0, 5)).toEqual(['-nostdin', '-hide_banner', '-y', '-loglevel', 'error']);
    expect(args).toEqual(expect.arrayContaining(['-protocol_whitelist', 'file']));
    const at = (flag: string) => args[args.indexOf(flag) + 1];
    expect(at('-ss')).toBe('12.300');
    expect(args.indexOf('-ss')).toBeLessThan(args.indexOf('-i'));
    expect(at('-i')).toBe('/scratch/source');
    expect(at('-t')).toBe('20.000');
    expect(args).not.toContain('-an');
    expect(at('-map')).toBe('0:v:0');
    expect(args).toEqual(expect.arrayContaining(['-map', '0:a:0']));
    expect(at('-c:a')).toBe('aac');
    expect(at('-b:a')).toBe(PREVIEW_AUDIO_BITRATE);
    expect(at('-ac')).toBe('2');
    expect(at('-vf')).toBe('scale=854:-2:flags=lanczos,fps=24,format=yuv420p');
    expect(at('-c:v')).toBe('libx264');
    expect(at('-profile:v')).toBe('main');
    expect(at('-level')).toBe('3.1');
    expect(at('-preset')).toBe('slow');
    expect(at('-crf')).toBe('27');
    expect(at('-maxrate')).toBe('900k');
    expect(at('-bufsize')).toBe('1800k');
    expect(at('-g')).toBe('48');
    expect(at('-keyint_min')).toBe('48');
    expect(at('-sc_threshold')).toBe('0');
    expect(at('-movflags')).toBe('+faststart');
    expect(at('-map_metadata')).toBe('-1');
    expect(args.at(-1)).toBe('/scratch/preview.mp4');
  });

  it('stays silent when the source has no audio track', () => {
    const silent = previewArgs({ input: 'i', container: 'mp4', startMs: 0, lengthMs: 6000, output: 'o', hasAudio: false });
    expect(silent).toContain('-an');
    expect(silent).not.toContain('-c:a');
    expect(silent).not.toContain('0:a:0');
  });

  it('takes a different crf for the oversize retry', () => {
    const retry = previewArgs({ input: 'i', container: 'mp4', startMs: 0, lengthMs: 6000, output: 'o', hasAudio: true, crf: PREVIEW_RETRY_CRF });
    expect(retry[retry.indexOf('-crf') + 1]).toBe('31');
  });
});

describe('previewKey and limits', () => {
  it('names the file by start and content hash under the public cap prefix', () => {
    const key = previewKey('abc123', 12_300, new Uint8Array([1, 2, 3]));
    expect(key).toMatch(/^cap\/abc123\/preview\/12300-[0-9a-f]{8}\.mp4$/);
    expect(previewKey('abc123', 12_300, new Uint8Array([1, 2, 3]))).toBe(key);
    expect(previewKey('abc123', 12_300, new Uint8Array([1, 2, 4]))).not.toBe(key);
  });

  it('keeps the planned limits', () => {
    expect(PREVIEW_AUDIO_BITRATE).toBe('48k');
    expect(previewMaxBytes(20_000)).toBe(2_400_000);
    expect(previewMaxBytes(6000)).toBe(720_000);
    expect(PREVIEW_SWEEP_BATCH).toBe(10);
  });
});
