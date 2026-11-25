import { describe, expect, it } from 'vitest';
import { HERO_CLIP_GRACE_MS, HERO_PREVIEW_DELAY_MS, slideDurationMs } from './hero-timing';

describe('slideDurationMs', () => {
  const base = { dwellMs: 20_000, waitForClip: true, clipMs: 20_000, hasClip: true };

  it('is the dwell time when the slide has no clip', () => {
    expect(slideDurationMs({ ...base, hasClip: false })).toBe(20_000);
  });

  it('is the dwell time when the owner setting says the dwell decides', () => {
    expect(slideDurationMs({ ...base, waitForClip: false })).toBe(20_000);
    expect(slideDurationMs({ ...base, waitForClip: false, clipMs: 8000 })).toBe(20_000);
  });

  it('waits for the clip: its length plus the 1.2 second start delay and a 2 second grace', () => {
    expect(slideDurationMs(base)).toBe(20_000 + HERO_PREVIEW_DELAY_MS + HERO_CLIP_GRACE_MS);
    expect(slideDurationMs({ ...base, clipMs: 8000 })).toBe(8000 + 1200 + 2000);
  });

  it('assumes the old 6 second length when the clip length is unknown', () => {
    expect(slideDurationMs({ ...base, clipMs: undefined })).toBe(6000 + 1200 + 2000);
  });

  it('has no duration when there is no dwell time (rotation off)', () => {
    expect(slideDurationMs({ ...base, dwellMs: undefined })).toBeUndefined();
  });
});
