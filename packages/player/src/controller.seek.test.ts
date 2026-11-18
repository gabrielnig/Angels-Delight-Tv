import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PlayerController } from './controller';
import { FakeEngine, FakeMedia } from './testing/fakes';

/** M08-S03 Error: a seek that fails retries once, then falls back to the nearest segment start. */

function setup(segmentStart?: (t: number) => number | null) {
  const media = new FakeMedia();
  const engine = new FakeEngine();
  if (segmentStart)
    (engine as unknown as { segmentStart: typeof segmentStart }).segmentStart = segmentStart;
  const c = new PlayerController({
    media,
    engine,
    tokens: { token: 't', masterUrl: 'https://app.test/m.m3u8', refresh: vi.fn() },
    videoId: 'v1',
    profileId: 'p1',
    sink: { save: vi.fn().mockResolvedValue(undefined) },
  });
  c.start();
  media.setDuration(300);
  return { c, media, engine };
}

describe('seek failure', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('does nothing extra when the seek completes', () => {
    const { c, media, engine } = setup();
    c.seekTo(100);
    media.emit('seeked');
    vi.advanceTimersByTime(30_000);
    expect(engine.recovers).toBe(0);
    expect(media.currentTime).toBe(100);
  });

  it('retries the seek once and restarts loading when it never completes', () => {
    const { c, media, engine } = setup();
    c.seekTo(100);
    media.currentTime = 12; // the element drifted
    vi.advanceTimersByTime(6_000);
    expect(media.currentTime).toBe(100);
    expect(engine.recovers).toBe(1);
  });

  it('falls back to the nearest segment start when the retry also fails', () => {
    const { c, media } = setup();
    c.seekTo(100);
    vi.advanceTimersByTime(6_000);
    vi.advanceTimersByTime(6_000);
    expect(media.currentTime).toBe(96);
    expect(c.getState().toast?.message).toMatch(/jumped to the nearest point/i);
  });

  it('asks the engine for the segment start when it can say', () => {
    const { c, media } = setup((t) => (t === 100 ? 98.5 : null));
    c.seekTo(100);
    vi.advanceTimersByTime(12_000);
    expect(media.currentTime).toBe(98.5);
  });

  it('stops watching after the fallback and when a new seek replaces the old one', () => {
    const { c, media, engine } = setup();
    c.seekTo(100);
    vi.advanceTimersByTime(6_000);
    c.seekTo(200);
    vi.advanceTimersByTime(5_000);
    expect(media.currentTime).toBe(200);
    expect(engine.recovers).toBe(1);
    media.emit('seeked');
    vi.advanceTimersByTime(30_000);
    expect(media.currentTime).toBe(200);
  });

  it('is cancelled on dispose', () => {
    const { c, media } = setup();
    c.seekTo(100);
    c.dispose();
    media.currentTime = 5;
    vi.advanceTimersByTime(30_000);
    expect(media.currentTime).toBe(5);
  });
});
