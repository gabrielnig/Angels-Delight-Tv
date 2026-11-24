import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PlayerController, type PlayerControllerOptions, type TokenSource } from './controller';
import { ProgressSinkError, type ProgressSink } from './progress';
import { SessionError } from './token';
import type { CaptionTrack } from './types';
import { FakeEngine, FakeMedia, FakeNetwork, FakePage } from './testing/fakes';

const APP = 'https://app.example.test';

function setup(
  extra: Partial<PlayerControllerOptions> = {},
  tokenOverrides: Partial<TokenSource> = {},
) {
  const media = new FakeMedia();
  const engine = new FakeEngine();
  const network = new FakeNetwork();
  const page = new FakePage();
  const save = vi.fn<ProgressSink['save']>().mockResolvedValue(undefined);
  const tokens: TokenSource = {
    token: 'tok-1',
    masterUrl: `${APP}/api/play/v1/master.m3u8`,
    refresh: vi.fn().mockResolvedValue({
      token: 'tok-2',
      expiresAt: Date.now() + 1_800_000,
      masterUrl: `${APP}/api/play/v1/master.m3u8`,
    }),
    ...tokenOverrides,
  };
  const onNext = vi.fn();
  const onPreferencesChange = vi.fn();
  const onUnauthorized = vi.fn();
  const c = new PlayerController({
    media,
    engine,
    tokens,
    videoId: 'v1',
    profileId: 'p1',
    sink: { save },
    network,
    page,
    onNext,
    onPreferencesChange,
    onUnauthorized,
    ...extra,
  });
  return {
    c,
    media,
    engine,
    network,
    page,
    save,
    tokens,
    onNext,
    onPreferencesChange,
    onUnauthorized,
  };
}

const approved: CaptionTrack = {
  id: 'en',
  language: 'en',
  label: 'English',
  src: '/c/en.vtt',
  status: 'approved',
};
const review: CaptionTrack = {
  id: 'yo',
  language: 'yo',
  label: 'Yoruba',
  src: '/c/yo.vtt',
  status: 'needs_review',
};

async function started(extra: Partial<PlayerControllerOptions> = {}, t: Partial<TokenSource> = {}) {
  const s = setup(extra, t);
  s.c.start();
  s.media.setDuration(300);
  await vi.advanceTimersByTimeAsync(0);
  return s;
}

describe('PlayerController', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-17T10:00:00Z'));
  });
  afterEach(() => vi.useRealTimers());

  describe('start', () => {
    it('loads the master playlist at the resume position and tries to play', async () => {
      const { engine, media } = await started({ resume: { saved: 134, duration: 300 } });
      expect(engine.loads[0]).toMatchObject({
        src: `${APP}/api/play/v1/master.m3u8`,
        startPosition: 131,
        lowData: false,
        cap: null,
      });
      expect(engine.tokens).toContain('tok-1');
      expect(media.playCalls).toBe(1);
    });

    it('shows the resume toast with a Start over action', () => {
      const { c } = setup({ resume: { saved: 134, duration: 300 } });
      c.start();
      expect(c.getState().toast).toMatchObject({
        kind: 'resume',
        message: 'Resumed from 2:14',
        action: 'start-over',
      });
    });

    it('starts low on Save-Data and when data saver is on', () => {
      const a = setup({ hints: { saveData: true } });
      a.c.start();
      expect(a.engine.loads[0]?.lowData).toBe(true);
      const b = setup({ preferences: { dataSaver: true } });
      b.c.start();
      expect(b.engine.loads[0]).toMatchObject({ lowData: true, cap: 360 });
    });

    it('applies stored volume, mute and speed', () => {
      const { c, media } = setup({ preferences: { volume: 0.4, muted: true, rate: 1.5 } });
      c.start();
      expect(media.volume).toBe(0.4);
      expect(media.muted).toBe(true);
      expect(media.playbackRate).toBe(1.5);
    });

    it('keeps the pitch natural at any speed (M08-S10 AC2)', () => {
      const { c, media } = setup({ preferences: { rate: 1.5 } });
      media.preservesPitch = false;
      c.start();
      expect(media.preservesPitch).toBe(true);
      media.preservesPitch = false;
      c.setRate(2);
      expect(media.preservesPitch).toBe(true);
    });

    it('stays paused with a play button when autoplay is blocked', async () => {
      const s = setup();
      s.media.playRejects = true;
      s.c.start();
      await vi.advanceTimersByTimeAsync(0);
      expect(s.c.getState().playing).toBe(false);
      expect(s.c.getState().error).toBeNull();
    });

    it('shows the spinner only after 500 ms of waiting for the first frame', () => {
      const { c, media } = setup();
      media.autoStart = false;
      c.start();
      expect(c.getState().phase).toBe('loading');
      expect(c.getState().buffering).toBe(false);
      vi.advanceTimersByTime(500);
      expect(c.getState().buffering).toBe(true);
    });

    it('shows the offline error instead of loading when offline', () => {
      const { c, engine, network } = setup();
      network.online = false;
      c.start();
      expect(c.getState().error).toBe('offline');
      expect(engine.loads).toHaveLength(0);
    });
  });

  describe('media state', () => {
    it('tracks play, pause, time, duration and buffering end', async () => {
      const { c, media } = await started();
      media.bufferedRanges = [[0, 40]];
      media.advance(12);
      const s = c.getState();
      expect(s).toMatchObject({
        phase: 'ready',
        playing: true,
        currentTime: 12,
        duration: 300,
        bufferedEnd: 40,
      });
      media.pause();
      expect(c.getState().playing).toBe(false);
    });

    it('notifies subscribers and supports unsubscribe', async () => {
      const { c, media } = await started();
      const fn = vi.fn();
      const off = c.subscribe(fn);
      media.advance(3);
      expect(fn).toHaveBeenCalled();
      fn.mockClear();
      off();
      media.advance(4);
      expect(fn).not.toHaveBeenCalled();
    });
  });

  describe('progress reporting', () => {
    it('writes every 15 seconds while playing', async () => {
      const { media, save } = await started();
      media.advance(14);
      await vi.advanceTimersByTimeAsync(15_000);
      expect(save).toHaveBeenCalledTimes(1);
      expect(save.mock.calls[0]?.[0]).toMatchObject({
        videoId: 'v1',
        profileId: 'p1',
        positionSeconds: 14,
        durationSeconds: 300,
      });
    });

    it('writes on pause, on seek and when the tab hides', async () => {
      const { media, save, page, c } = await started();
      media.advance(20);
      media.pause();
      expect(save).toHaveBeenCalledTimes(1);
      c.seekTo(100);
      media.emit('seeked');
      await vi.advanceTimersByTimeAsync(0);
      expect(save).toHaveBeenCalledTimes(2);
      media.currentTime = 101;
      page.setHidden(true);
      expect(save).toHaveBeenCalledTimes(3);
    });

    it('sends a beacon on page hide', async () => {
      const { media, save, page } = await started();
      media.advance(33);
      page.pagehide();
      expect(save).toHaveBeenLastCalledWith(expect.objectContaining({ positionSeconds: 33 }), {
        beacon: true,
      });
    });

    it('queues the newest position while offline and sends it when back online', async () => {
      const { media, save, network } = await started();
      media.advance(20);
      network.set(false);
      media.pause();
      expect(save).not.toHaveBeenCalled();
      network.set(true);
      await vi.advanceTimersByTimeAsync(0);
      expect(save).toHaveBeenCalledWith(
        expect.objectContaining({ positionSeconds: 20 }),
        undefined,
      );
    });

    it('stops with a sign in prompt on a 401 write', async () => {
      const { media, save, c, onUnauthorized } = await started();
      save.mockRejectedValue(new ProgressSinkError(401));
      media.advance(10);
      media.pause();
      await vi.advanceTimersByTimeAsync(0);
      expect(onUnauthorized).toHaveBeenCalled();
      expect(c.getState().error).toBe('session-expired');
    });
  });

  describe('stalls and slow networks', () => {
    it('shows a spinner after 500 ms, the slow notice after 8 s and drops quality on Auto', async () => {
      const { c, media, engine } = await started();
      media.emit('waiting');
      await vi.advanceTimersByTimeAsync(499);
      expect(c.getState().buffering).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      expect(c.getState().buffering).toBe(true);
      await vi.advanceTimersByTimeAsync(7_500);
      expect(c.getState().slowNotice).toBe(true);
      expect(engine.dropCalls).toBe(1);
    });

    it('does not claim to switch quality when a manual rung is locked', async () => {
      const { c, media, engine } = await started();
      engine.emit({ type: 'levels', heights: [360, 480, 720] });
      c.selectQuality(720);
      media.emit('waiting');
      await vi.advanceTimersByTimeAsync(8_000);
      expect(c.getState().slowNotice).toBe(false);
      expect(engine.dropCalls).toBe(0);
    });

    it('clears the spinner when playback resumes and counts the rebuffer', async () => {
      const metrics = { report: vi.fn() };
      const { c, media } = await started({ metrics, deviceClass: 'phone' });
      media.emit('waiting');
      await vi.advanceTimersByTimeAsync(2_000);
      media.emit('playing');
      expect(c.getState().buffering).toBe(false);
      expect(c.getState().slowNotice).toBe(false);
      c.dispose();
      const final = metrics.report.mock.calls.at(-1)?.[0];
      expect(final).toMatchObject({ rebufferCount: 1, final: true, deviceClass: 'phone' });
      expect(final.rebufferMs).toBeGreaterThanOrEqual(2_000);
    });

    it('starts recovery after a 20 second stall', async () => {
      const { c, media, engine } = await started();
      engine.canDrop = false;
      media.advance(50);
      media.emit('waiting');
      await vi.advanceTimersByTimeAsync(20_000);
      expect(c.getState().error).toBe('connection-lost');
      expect(c.getState().currentTime).toBe(50);
    });
  });

  describe('network error recovery', () => {
    it('drops one rendition and retries before showing an error', async () => {
      const { c, engine } = await started();
      engine.emit({
        type: 'error',
        error: { kind: 'network', fatal: true, detail: 'fragLoadError' },
      });
      expect(engine.dropCalls).toBe(1);
      expect(engine.recovers).toBe(1);
      expect(c.getState().error).toBeNull();
    });

    it('shows Connection lost when nothing is left to drop and keeps the position', async () => {
      const { c, engine, media, save } = await started();
      engine.canDrop = false;
      media.advance(42);
      engine.emit({
        type: 'error',
        error: { kind: 'network', fatal: true, detail: 'fragLoadError' },
      });
      expect(c.getState().error).toBe('connection-lost');
      expect(c.getState().phase).toBe('error');
      expect(media.currentTime).toBe(42);
      expect(save).toHaveBeenCalledWith(
        expect.objectContaining({ positionSeconds: 42 }),
        undefined,
      );
    });

    it('ignores non fatal engine errors', async () => {
      const { c, engine } = await started();
      engine.emit({ type: 'error', error: { kind: 'network', fatal: false, detail: 'retrying' } });
      expect(c.getState().error).toBeNull();
      expect(engine.recovers).toBe(0);
    });

    it('Retry recovers the engine and resumes from the same position', async () => {
      const { c, engine, media } = await started();
      engine.canDrop = false;
      media.advance(42);
      engine.emit({ type: 'error', error: { kind: 'network', fatal: true, detail: 'x' } });
      media.pause();
      const plays = media.playCalls;
      c.retry();
      expect(c.getState().error).toBeNull();
      expect(engine.recovers).toBe(1);
      expect(media.currentTime).toBe(42);
      expect(media.playCalls).toBe(plays + 1);
    });

    it('auto retries when the browser comes back online', async () => {
      const { c, engine, network, media } = await started();
      engine.canDrop = false;
      engine.emit({ type: 'error', error: { kind: 'network', fatal: true, detail: 'x' } });
      network.set(false);
      network.set(true);
      expect(c.getState().error).toBeNull();
      expect(engine.recovers).toBe(1);
      expect(media.paused).toBe(false);
    });
  });

  describe('offline behaviour', () => {
    it('pauses with the offline error when buffered video runs out', async () => {
      const { c, media, network } = await started();
      media.bufferedRanges = [[0, 30]];
      media.advance(10);
      network.set(false);
      expect(c.getState().error).toBeNull();
      media.advance(30);
      media.emit('waiting');
      expect(c.getState().error).toBe('offline');
      expect(media.paused).toBe(true);
    });

    it('resumes by itself when back online if the viewer was playing', async () => {
      const { c, media, network, engine } = await started();
      network.set(false);
      media.emit('waiting');
      expect(c.getState().error).toBe('offline');
      network.set(true);
      expect(c.getState().error).toBeNull();
      expect(engine.recovers).toBe(1);
      expect(media.paused).toBe(false);
    });

    it('offers Resume when the viewer had paused', async () => {
      const { c, media, network } = await started();
      media.pause();
      network.set(false);
      media.emit('waiting');
      expect(c.getState().error).toBe('offline');
      network.set(true);
      expect(c.getState().backOnline).toBe(true);
    });

    it('loads normally when a viewer who opened the page offline comes online', () => {
      const { c, engine, network } = setup();
      network.online = false;
      c.start();
      network.set(true);
      expect(engine.loads).toHaveLength(1);
      expect(c.getState().error).toBeNull();
    });
  });

  describe('expired tokens', () => {
    const auth = { kind: 'auth', fatal: true, status: 401, detail: 'keyLoadError' } as const;

    it('refreshes once and reloads from the current position', async () => {
      const { c, engine, media, tokens } = await started();
      media.advance(77);
      engine.emit({ type: 'error', error: auth });
      await vi.advanceTimersByTimeAsync(0);
      expect(tokens.refresh).toHaveBeenCalledTimes(1);
      expect(engine.tokens.at(-1)).toBe('tok-2');
      expect(engine.reloads).toEqual([77]);
      expect(c.getState().error).toBeNull();
    });

    it('keeps playing after the reload even though tearing down the engine paused the element', async () => {
      const { engine, media } = await started();
      media.advance(30);
      const original = engine.reload.bind(engine);
      engine.reload = (pos: number) => {
        original(pos);
        // Destroying hls.js detaches the source, which resets paused on a real element.
        media.paused = true;
      };
      engine.emit({ type: 'error', error: auth });
      await vi.advanceTimersByTimeAsync(0);
      expect(media.paused).toBe(false);
    });

    it('starts playing after a reload that happened before the first frame', async () => {
      const s = setup();
      s.media.autoStart = false;
      s.c.start();
      const original = s.engine.reload.bind(s.engine);
      s.engine.reload = (pos: number) => {
        original(pos);
        s.media.paused = true;
      };
      s.engine.emit({ type: 'error', error: auth });
      await vi.advanceTimersByTimeAsync(0);
      expect(s.media.playCalls).toBeGreaterThanOrEqual(2);
    });

    it('treats a 403 on a segment the same way', async () => {
      const { engine, tokens } = await started();
      engine.emit({
        type: 'error',
        error: { kind: 'forbidden', fatal: true, status: 403, detail: 'fragLoadError' },
      });
      await vi.advanceTimersByTimeAsync(0);
      expect(tokens.refresh).toHaveBeenCalledTimes(1);
      expect(engine.reloads).toHaveLength(1);
    });

    it('shows Sign in again when the refresh is refused with 401', async () => {
      const { c, engine } = await started(
        {},
        { refresh: vi.fn().mockRejectedValue(new SessionError('auth')) },
      );
      engine.emit({ type: 'error', error: auth });
      await vi.advanceTimersByTimeAsync(0);
      expect(c.getState().error).toBe('session-expired');
    });

    it('shows the removed message when the video is gone', async () => {
      const { c, engine } = await started(
        {},
        { refresh: vi.fn().mockRejectedValue(new SessionError('gone')) },
      );
      engine.emit({ type: 'error', error: auth });
      await vi.advanceTimersByTimeAsync(0);
      expect(c.getState().error).toBe('removed');
    });

    it('falls back to Connection lost when the refresh fails on the network', async () => {
      const { c, engine } = await started(
        {},
        { refresh: vi.fn().mockRejectedValue(new SessionError('network')) },
      );
      engine.emit({ type: 'error', error: auth });
      await vi.advanceTimersByTimeAsync(0);
      expect(c.getState().error).toBe('connection-lost');
    });

    it('gives up when the error returns right after a refresh', async () => {
      const { c, engine, tokens } = await started();
      engine.emit({ type: 'error', error: auth });
      await vi.advanceTimersByTimeAsync(0);
      engine.emit({ type: 'error', error: auth });
      await vi.advanceTimersByTimeAsync(0);
      expect(tokens.refresh).toHaveBeenCalledTimes(1);
      expect(c.getState().error).toBe('session-expired');
    });

    it('allows another refresh once playback has been healthy for a while', async () => {
      const { engine, tokens } = await started();
      engine.emit({ type: 'error', error: auth });
      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(20_000);
      engine.emit({ type: 'error', error: auth });
      await vi.advanceTimersByTimeAsync(0);
      expect(tokens.refresh).toHaveBeenCalledTimes(2);
    });

    it('a refused scheduled refresh stops playback at the end of buffered video', async () => {
      const { c, media } = await started();
      media.bufferedRanges = [[0, 100]];
      media.advance(50);
      c.handleSessionFailure(new SessionError('gone'));
      expect(c.getState().error).toBeNull();
      media.advance(99.8);
      expect(c.getState().error).toBe('removed');
      expect(media.paused).toBe(true);
    });

    it('a refused scheduled refresh for a signed out viewer shows Sign in again', async () => {
      const { c, media } = await started();
      media.bufferedRanges = [[0, 100]];
      c.handleSessionFailure(new SessionError('auth'));
      media.advance(99.9);
      expect(c.getState().error).toBe('session-expired');
    });
  });

  describe('decode and support failures', () => {
    it('tries a lower rendition, then reports the device cannot play it', async () => {
      const { c, media, engine } = await started();
      media.error = { code: 3 };
      media.emit('error');
      expect(engine.dropCalls).toBe(1);
      expect(engine.mediaRecovers).toBe(1);
      expect(c.getState().error).toBeNull();
      media.emit('error');
      expect(c.getState().error).toBe('cannot-play');
    });

    it('maps an unsupported engine to the browser message', async () => {
      const { c, engine } = await started();
      engine.emit({ type: 'error', error: { kind: 'unsupported', fatal: true, detail: 'no MSE' } });
      expect(c.getState().error).toBe('unsupported-browser');
    });

    it('maps a gone video from the engine to the removed message', async () => {
      const { c, engine } = await started();
      engine.emit({
        type: 'error',
        error: { kind: 'gone', fatal: true, status: 404, detail: 'manifestLoadError' },
      });
      expect(c.getState().error).toBe('removed');
    });
  });

  describe('end screen and up next', () => {
    const next = { id: 'v2', title: 'Why the Sky Is Blue' };

    it('marks the video finished and runs the autoplay countdown', async () => {
      const { c, media, save, onNext } = await started({
        upNext: next,
        preferences: { autoplayNext: true },
        countdownSeconds: 5,
      });
      media.advance(299);
      media.finish();
      await vi.advanceTimersByTimeAsync(0);
      expect(c.getState().phase).toBe('ended');
      expect(save).toHaveBeenLastCalledWith(
        expect.objectContaining({ ended: true, positionSeconds: 300 }),
        undefined,
      );
      expect(c.getState().upNext.countdown).toBe(5);
      await vi.advanceTimersByTimeAsync(3_000);
      expect(c.getState().upNext.countdown).toBe(2);
      expect(onNext).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(2_000);
      expect(onNext).toHaveBeenCalledWith(next);
    });

    it('announces the countdown once', async () => {
      const { c, media } = await started({ upNext: next, preferences: { autoplayNext: true } });
      media.finish();
      expect(c.getState().announce).toBe('Next video starts in 5 seconds');
      await vi.advanceTimersByTimeAsync(1_000);
      expect(c.getState().announce).toBe('Next video starts in 5 seconds');
    });

    it('Cancel stops the countdown and keeps the card', async () => {
      const { c, media, onNext } = await started({
        upNext: next,
        preferences: { autoplayNext: true },
      });
      media.finish();
      c.cancelCountdown();
      await vi.advanceTimersByTimeAsync(10_000);
      expect(onNext).not.toHaveBeenCalled();
      expect(c.getState().upNext).toMatchObject({ countdown: null, cancelled: true });
      expect(c.getState().phase).toBe('ended');
    });

    it('does not count down when autoplay is off', async () => {
      const { c, media, onNext } = await started({
        upNext: next,
        preferences: { autoplayNext: false },
      });
      media.finish();
      await vi.advanceTimersByTimeAsync(10_000);
      expect(c.getState().upNext.countdown).toBeNull();
      expect(onNext).not.toHaveBeenCalled();
    });

    it('does not count down with no next title', async () => {
      const { c, media } = await started({ upNext: null, preferences: { autoplayNext: true } });
      media.finish();
      expect(c.getState().upNext.countdown).toBeNull();
    });

    it('Play now goes to the next title at once', async () => {
      const { c, media, onNext } = await started({
        upNext: next,
        preferences: { autoplayNext: true },
      });
      media.finish();
      c.playNext();
      expect(onNext).toHaveBeenCalledWith(next);
      await vi.advanceTimersByTimeAsync(10_000);
      expect(onNext).toHaveBeenCalledTimes(1);
    });

    it('Replay restarts from zero', async () => {
      const { c, media } = await started();
      media.finish();
      c.replay();
      expect(media.currentTime).toBe(0);
      expect(media.ended).toBe(false);
      expect(c.getState().phase).toBe('ready');
    });

    it('shows the next tile in the last 15 seconds and lets it be dismissed', async () => {
      const { c, media } = await started({ upNext: next });
      media.advance(284);
      expect(c.getState().upNext.tile).toBe(false);
      media.advance(286);
      expect(c.getState().upNext.tile).toBe(true);
      c.dismissUpNextTile();
      media.advance(290);
      expect(c.getState().upNext.tile).toBe(false);
    });

    it('never shows the tile without a next title', async () => {
      const { c, media } = await started({ upNext: null });
      media.advance(295);
      expect(c.getState().upNext.tile).toBe(false);
    });
  });

  describe('volume, speed and preferences', () => {
    it('clamps volume, persists it and unmutes when raised', async () => {
      const { c, media, onPreferencesChange } = await started();
      c.setVolume(1.4);
      expect(media.volume).toBe(1);
      c.setVolume(0.35);
      expect(onPreferencesChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ volume: 0.35 }),
      );
      c.toggleMute();
      expect(media.muted).toBe(true);
      expect(onPreferencesChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ muted: true }),
      );
    });

    it('adjusts volume in 5 percent steps without float drift', async () => {
      const { c, media } = await started({ preferences: { volume: 0.5 } });
      c.adjustVolume(0.05);
      expect(media.volume).toBe(0.55);
      c.adjustVolume(-0.05);
      c.adjustVolume(-0.05);
      expect(media.volume).toBe(0.45);
    });

    it('sets speed from the allowed list and steps within it', async () => {
      const { c, media } = await started();
      c.setRate(1.5);
      expect(media.playbackRate).toBe(1.5);
      c.stepRate(1);
      expect(media.playbackRate).toBe(2);
      c.stepRate(1);
      expect(media.playbackRate).toBe(2);
      c.setRate(0.6);
      expect(media.playbackRate).toBe(0.5);
    });
  });

  describe('quality', () => {
    it('builds the menu from the levels the engine reports', async () => {
      const { c, engine } = await started();
      engine.emit({ type: 'levels', heights: [360, 480, 720] });
      engine.emit({ type: 'level', height: 480 });
      const menu = c.getState().quality.menu;
      expect(menu.visible).toBe(true);
      expect(menu.items.map((i) => i.id)).toEqual(['auto', '720', '480', '360']);
      expect(menu.items[0]?.detail).toBe('480p now');
    });

    it('locks a chosen rendition and returns to Auto', async () => {
      const { c, engine } = await started();
      engine.emit({ type: 'levels', heights: [360, 480, 720] });
      c.selectQuality(480);
      expect(engine.qualityCalls.at(-1)).toEqual({ selection: 480, cap: null });
      expect(c.getState().quality.selected).toBe(480);
      c.selectQuality('auto');
      expect(c.getState().quality.selected).toBe('auto');
    });

    it('refuses a rung above the data saver cap', async () => {
      const { c, engine } = await started({ preferences: { dataSaver: true } });
      engine.emit({ type: 'levels', heights: [360, 480, 720] });
      c.selectQuality(720);
      expect(c.getState().quality.selected).toBe('auto');
      expect(c.getState().quality.menu.items.find((i) => i.id === '720')?.disabled).toBe(true);
    });

    it('applies the cap live when data saver is switched on', async () => {
      const { c, engine, onPreferencesChange } = await started();
      engine.emit({ type: 'levels', heights: [360, 480, 720] });
      c.selectQuality(720);
      c.setDataSaver(true);
      expect(c.getState().quality.selected).toBe('auto');
      expect(engine.qualityCalls.at(-1)).toEqual({ selection: 'auto', cap: 360 });
      expect(onPreferencesChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ dataSaver: true }),
      );
    });

    it('hides the menu for a single rendition', async () => {
      const { c, engine } = await started();
      engine.emit({ type: 'levels', heights: [360] });
      expect(c.getState().quality.menu.visible).toBe(false);
    });
  });

  describe('captions', () => {
    it('attaches only approved tracks', () => {
      const { c } = setup({ captions: [approved, review] });
      expect(c.getState().captions.tracks.map((t) => t.id)).toEqual(['en']);
    });

    it('has no captions control state when there are none', () => {
      const { c } = setup({ captions: [review] });
      expect(c.getState().captions).toMatchObject({ available: false, active: null });
    });

    it('starts on or off from the stored preference', () => {
      expect(
        setup({ captions: [approved], preferences: { captionsOn: true } }).c.getState().captions
          .active,
      ).toBe('en');
      expect(
        setup({ captions: [approved], preferences: { captionsOn: false } }).c.getState().captions
          .active,
      ).toBeNull();
    });

    it('toggles and remembers the choice', () => {
      const { c, onPreferencesChange } = setup({ captions: [approved] });
      c.toggleCaptions();
      expect(c.getState().captions.active).toBe('en');
      expect(onPreferencesChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ captionsOn: true, captionLanguage: 'en' }),
      );
      c.toggleCaptions();
      expect(c.getState().captions.active).toBeNull();
      expect(onPreferencesChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ captionsOn: false }),
      );
    });

    it('does nothing when there are no tracks', () => {
      const { c } = setup({ captions: [] });
      c.toggleCaptions();
      expect(c.getState().captions.active).toBeNull();
    });

    it('the c key does nothing when there are no tracks', () => {
      const { c, onPreferencesChange } = setup({ captions: [], preferences: { captionsOn: true } });
      c.dispatch({ type: 'toggle-captions' });
      expect(c.getState().captions).toMatchObject({ available: false, active: null });
      expect(onPreferencesChange).not.toHaveBeenCalled();
    });

    it('the c key toggles when a track exists', () => {
      const { c } = setup({ captions: [approved] });
      c.dispatch({ type: 'toggle-captions' });
      expect(c.getState().captions.active).toBe('en');
      c.dispatch({ type: 'toggle-captions' });
      expect(c.getState().captions.active).toBeNull();
    });

    it('watching a video without captions keeps the saved choice for the next one', () => {
      const { c, onPreferencesChange } = setup({ captions: [], preferences: { captionsOn: true, captionLanguage: 'en' } });
      c.setVolume?.(0.5);
      for (const call of onPreferencesChange.mock.calls) {
        expect(call[0]).toMatchObject({ captionsOn: true, captionLanguage: 'en' });
      }
    });

    it('picks the profile language when several tracks exist', () => {
      const yo = { ...review, status: 'approved' };
      const { c } = setup({
        captions: [approved, yo],
        preferences: { captionsOn: true, captionLanguage: 'yo' },
      });
      expect(c.getState().captions.active).toBe('yo');
    });

    it('shows a toast when a track fails and keeps playing', () => {
      const { c } = setup({ captions: [approved], preferences: { captionsOn: true } });
      c.captionFailed('en');
      expect(c.getState().toast).toMatchObject({
        kind: 'error',
        message: 'Captions could not load',
      });
      expect(c.getState().error).toBeNull();
    });

    it('falls back to English when another language fails', () => {
      const yo = { ...review, status: 'approved' };
      const { c } = setup({
        captions: [approved, yo],
        preferences: { captionsOn: true, captionLanguage: 'yo' },
      });
      c.captionFailed('yo');
      expect(c.getState().captions.active).toBe('en');
    });
  });

  describe('commands and shortcuts', () => {
    it('seeks relative, clamped to the media', async () => {
      const { c, media } = await started();
      media.advance(100);
      c.seekBy(5);
      expect(media.currentTime).toBe(105);
      c.seekBy(-500);
      expect(media.currentTime).toBe(0);
      media.advance(298);
      c.seekBy(10);
      expect(media.currentTime).toBe(300);
    });

    it('dispatches keyboard actions', async () => {
      const { c, media } = await started();
      c.dispatch({ type: 'seek-fraction', fraction: 0.5 });
      expect(media.currentTime).toBe(150);
      c.dispatch({ type: 'seek-start' });
      expect(media.currentTime).toBe(0);
      c.dispatch({ type: 'seek-end' });
      expect(media.currentTime).toBe(299);
      c.dispatch({ type: 'toggle-play' });
      expect(media.paused).toBe(true);
      c.dispatch({ type: 'toggle-play' });
      expect(media.paused).toBe(false);
      c.dispatch({ type: 'volume-by', delta: -0.05 });
      expect(media.volume).toBe(0.95);
      c.dispatch({ type: 'speed-step', direction: -1 });
      expect(media.playbackRate).toBe(0.75);
    });

    it('Start over seeks to zero and saves zero', async () => {
      const { c, media, save } = await started({ resume: { saved: 134, duration: 300 } });
      media.advance(131);
      c.startOver();
      expect(media.currentTime).toBe(0);
      expect(c.getState().toast).toBeNull();
      await vi.advanceTimersByTimeAsync(0);
      expect(save).toHaveBeenLastCalledWith(
        expect.objectContaining({ positionSeconds: 0 }),
        undefined,
      );
    });
  });

  describe('lifecycle', () => {
    it('cleans up on dispose', async () => {
      const { c, engine, media, save } = await started();
      media.advance(30);
      c.dispose();
      expect(engine.destroyed).toBe(true);
      expect(save).toHaveBeenCalledWith(
        expect.objectContaining({ positionSeconds: 30 }),
        expect.anything(),
      );
      const fn = vi.fn();
      c.subscribe(fn);
      media.advance(40);
      expect(fn).not.toHaveBeenCalled();
    });

    it('pushes a refreshed token to the engine', async () => {
      const listeners: Array<(s: { token: string }) => void> = [];
      const { engine } = await started(
        {},
        {
          subscribe: (l) => {
            listeners.push(l);
            return () => undefined;
          },
        },
      );
      listeners[0]?.({ token: 'tok-9' });
      expect(engine.tokens.at(-1)).toBe('tok-9');
    });
  });
});
