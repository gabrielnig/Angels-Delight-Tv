import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PlayerController, type PlayerControllerOptions } from './controller';
import { FakeEngine, FakeMedia } from './testing/fakes';

const next = { id: 'v2', title: 'Why the Sky Is Blue' };

function memoryStreak(start = 0) {
  let value = start;
  return {
    get: () => value,
    set: (n: number) => {
      value = n;
    },
    peek: () => value,
  };
}

function setup(opts: Partial<PlayerControllerOptions> = {}) {
  const media = new FakeMedia();
  const onNext = vi.fn();
  const prefetchNext = vi.fn();
  const c = new PlayerController({
    media,
    engine: new FakeEngine(),
    tokens: { token: 't', masterUrl: 'https://app.test/m.m3u8', refresh: vi.fn() },
    videoId: 'v1',
    profileId: 'p1',
    sink: { save: vi.fn().mockResolvedValue(undefined) },
    upNext: next,
    preferences: { autoplayNext: true },
    onNext,
    prefetchNext,
    ...opts,
  });
  c.start();
  media.setDuration(300);
  return { c, media, onNext, prefetchNext };
}

function at(media: FakeMedia, seconds: number) {
  media.currentTime = seconds;
  media.emit('timeupdate');
}

describe('up next and autoplay (L4-08)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  describe('countdown length', () => {
    it.each([
      [undefined, 5],
      [3, 5],
      [4.6, 5],
      [7, 7],
      [10, 10],
      [30, 10],
      [Number.NaN, 5],
    ])('uses %s as %s seconds', (given, expected) => {
      const { c, media } = setup({ countdownSeconds: given as number });
      media.finish();
      expect(c.getState().upNext.countdown).toBe(expected);
    });
  });

  describe('when the Next tile shows', () => {
    it('shows at credits start when a credits marker and a next title exist', () => {
      const { c, media } = setup({ markers: { credits: { start: 200, end: null } } });
      at(media, 150);
      expect(c.getState().upNext.tile).toBe(false);
      at(media, 201);
      expect(c.getState().upNext.tile).toBe(true);
    });

    it('does not use the last 15 seconds rule when credits start earlier', () => {
      const { c, media } = setup({ markers: { credits: { start: 200, end: null } } });
      at(media, 150);
      expect(c.getState().upNext.tile).toBe(false);
    });

    it('falls back to the last 15 seconds without a marker', () => {
      const { c, media } = setup();
      at(media, 280);
      expect(c.getState().upNext.tile).toBe(false);
      at(media, 290);
      expect(c.getState().upNext.tile).toBe(true);
    });

    it('never shows without a next title', () => {
      const { c, media } = setup({
        upNext: null,
        markers: { credits: { start: 200, end: null } },
      });
      at(media, 250);
      expect(c.getState().upNext.tile).toBe(false);
    });
  });

  describe('prefetch under Data saver (M08-S13 AC5)', () => {
    it('warms the next page once when the tile shows', () => {
      const { media, prefetchNext } = setup();
      at(media, 290);
      at(media, 292);
      expect(prefetchNext).toHaveBeenCalledTimes(1);
      expect(prefetchNext).toHaveBeenCalledWith(next);
    });

    it('does not prefetch with Data saver on, even through the countdown', async () => {
      const { c, media, prefetchNext, onNext } = setup({
        preferences: { autoplayNext: true, dataSaver: true },
      });
      at(media, 290);
      media.finish();
      expect(prefetchNext).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(5_000);
      expect(onNext).toHaveBeenCalledWith(next);
      expect(c.getState().phase).toBe('ended');
      expect(prefetchNext).not.toHaveBeenCalled();
    });

    it('does not prefetch when Data saver is turned on before the tile', () => {
      const { c, media, prefetchNext } = setup();
      c.setDataSaver(true);
      at(media, 290);
      expect(prefetchNext).not.toHaveBeenCalled();
    });
  });

  describe('Still watching after three unattended autoplays', () => {
    it('counts an autoplay when the countdown ends', async () => {
      const streak = memoryStreak();
      const { media } = setup({ autoplayStreak: streak });
      media.finish();
      await vi.advanceTimersByTimeAsync(5_000);
      expect(streak.peek()).toBe(1);
    });

    it('asks after three, with no countdown and no navigation', async () => {
      const streak = memoryStreak(3);
      const { c, media, onNext } = setup({ autoplayStreak: streak });
      media.finish();
      await vi.advanceTimersByTimeAsync(20_000);
      expect(c.getState().upNext.stillWatching).toBe(true);
      expect(c.getState().upNext.countdown).toBeNull();
      expect(onNext).not.toHaveBeenCalled();
    });

    it('does not ask at two', () => {
      const { c, media } = setup({ autoplayStreak: memoryStreak(2) });
      media.finish();
      expect(c.getState().upNext.stillWatching).toBe(false);
      expect(c.getState().upNext.countdown).toBe(5);
    });

    it('any input resets the streak', () => {
      const streak = memoryStreak(2);
      const { c } = setup({ autoplayStreak: streak });
      c.noteInput();
      expect(streak.peek()).toBe(0);
    });

    it('Keep watching resets the streak and plays the next title', () => {
      const streak = memoryStreak(3);
      const { c, media, onNext } = setup({ autoplayStreak: streak });
      media.finish();
      c.keepWatching();
      expect(streak.peek()).toBe(0);
      expect(onNext).toHaveBeenCalledWith(next);
      expect(c.getState().upNext.stillWatching).toBe(false);
    });

    it('Stop keeps the card with Play next and does not navigate', () => {
      const { c, media, onNext } = setup({ autoplayStreak: memoryStreak(3) });
      media.finish();
      c.stopAutoplay();
      expect(onNext).not.toHaveBeenCalled();
      expect(c.getState().upNext).toMatchObject({ stillWatching: false, cancelled: true });
    });

    it('does not ask when autoplay is off', () => {
      const { c, media } = setup({
        autoplayStreak: memoryStreak(3),
        preferences: { autoplayNext: false },
      });
      media.finish();
      expect(c.getState().upNext.stillWatching).toBe(false);
    });
  });

  describe('Autoplay next switch (L4-07)', () => {
    it('starts from the saved preference', () => {
      expect(setup().c.getState().autoplayNext).toBe(true);
      expect(setup({ preferences: { autoplayNext: false } }).c.getState().autoplayNext).toBe(false);
    });

    it('setAutoplayNext updates the state and tells the host to save it', () => {
      const onPreferencesChange = vi.fn();
      const { c } = setup({ onPreferencesChange });
      c.setAutoplayNext(false);
      expect(c.getState().autoplayNext).toBe(false);
      expect(onPreferencesChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ autoplayNext: false }),
      );
    });

    it('turning it off stops the countdown from running at the end', () => {
      const { c, media } = setup();
      c.setAutoplayNext(false);
      media.finish();
      expect(c.getState().upNext.countdown).toBeNull();
    });

    it('turning it on during the video counts down at the end', () => {
      const { c, media } = setup({ preferences: { autoplayNext: false } });
      c.setAutoplayNext(true);
      media.finish();
      expect(c.getState().upNext.countdown).toBe(5);
    });
  });
});
