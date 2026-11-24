import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PlayerController, type PlayerControllerOptions } from './controller';
import { FakeEngine, FakeMedia } from './testing/fakes';
import type { PlaybackTelemetry } from './types';

const markers = {
  intro: { start: 12, end: 48 },
  recap: { start: 60, end: 90 },
  credits: { start: 240, end: null },
};
const chapters = [
  { start: 0, title: 'Welcome' },
  { start: 100, title: 'Mixing colours' },
];

function setup(opts: Partial<PlayerControllerOptions> = {}, withDuration = true) {
  const media = new FakeMedia();
  const engine = new FakeEngine();
  const onNext = vi.fn();
  const telemetry = {
    onStartup: vi.fn(),
    onTimeUpdate: vi.fn(),
    onPause: vi.fn(),
    onEnded: vi.fn(),
    onHide: vi.fn(),
    setHeight: vi.fn(),
    onError: vi.fn(),
    onSkip: vi.fn(),
  } satisfies PlaybackTelemetry;
  const c = new PlayerController({
    media,
    engine,
    tokens: { token: 't', masterUrl: 'https://app.test/m.m3u8', refresh: vi.fn() },
    videoId: 'v1',
    profileId: 'p1',
    sink: { save: vi.fn().mockResolvedValue(undefined) },
    markers,
    chapters,
    onNext,
    telemetry,
    ...opts,
  });
  c.start();
  if (withDuration) media.setDuration(300);
  return { c, media, engine, onNext, telemetry };
}

function at(media: FakeMedia, seconds: number) {
  media.currentTime = seconds;
  media.emit('timeupdate');
}

describe('markers in the controller', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('exposes the active marker while the time is inside a window', () => {
    const { c, media } = setup();
    at(media, 20);
    expect(c.getState().marker).toEqual({ kind: 'intro', skipTo: 48, nextLesson: false });
  });

  it('clears the marker when playback leaves the window', () => {
    const { c, media } = setup();
    at(media, 20);
    at(media, 50);
    expect(c.getState().marker).toBeNull();
  });

  it('shows the marker at once when resume lands inside the intro', () => {
    const { c } = setup({ resume: { saved: 33, duration: 300 } });
    expect(c.getState().marker?.kind).toBe('intro');
  });

  it('skip seeks to the end of the window and keeps playing', () => {
    const { c, media } = setup();
    media.play();
    at(media, 20);
    c.skip();
    expect(media.currentTime).toBe(48);
    expect(media.paused).toBe(false);
    at(media, 48);
    expect(c.getState().marker).toBeNull();
  });

  it('skip on credits with a next title plays the next title', () => {
    const next = { id: 'v2', title: 'Next lesson' };
    const { c, media, onNext } = setup({ upNext: next });
    at(media, 250);
    expect(c.getState().marker).toEqual({ kind: 'credits', skipTo: 300, nextLesson: true });
    c.skip();
    expect(onNext).toHaveBeenCalledWith(next);
  });

  it('skip on credits without a next title seeks to the end', () => {
    const { c, media, onNext } = setup();
    at(media, 250);
    c.skip();
    expect(onNext).not.toHaveBeenCalled();
    expect(media.currentTime).toBe(300);
  });

  it('does not offer a skipped marker again in the same pass', () => {
    const { c, media } = setup();
    at(media, 20);
    c.skip();
    media.currentTime = 30; // still inside the window, as a late tick would report
    media.emit('timeupdate');
    expect(c.getState().marker).toBeNull();
  });

  it('offers it again after seeking back before its start', () => {
    const { c, media } = setup();
    at(media, 20);
    c.skip();
    at(media, 5);
    at(media, 20);
    expect(c.getState().marker?.kind).toBe('intro');
  });

  it('announces the skip button when its window starts, with no key hint', () => {
    const { c, media } = setup();
    at(media, 12);
    expect(c.getState().announce).toBe('Skip intro available');
    at(media, 50);
    at(media, 62);
    expect(c.getState().announce).toBe('Skip recap available');
  });

  it('reports a skip to telemetry with kind, from and to', () => {
    const { c, media, telemetry } = setup();
    at(media, 20);
    c.skip();
    expect(telemetry.onSkip).toHaveBeenCalledWith('intro', 20_000, 48_000);
  });

  it('does not change the marker object on ticks that stay inside the same window', () => {
    const { c, media } = setup();
    at(media, 20);
    const first = c.getState().marker;
    at(media, 21);
    expect(c.getState().marker).toBe(first);
  });

  it('exposes the current chapter and changes it only at a boundary', () => {
    const { c, media } = setup();
    at(media, 10);
    const first = c.getState().chapter;
    expect(first).toEqual({ index: 0, title: 'Welcome' });
    at(media, 11);
    expect(c.getState().chapter).toBe(first);
    at(media, 100);
    expect(c.getState().chapter).toEqual({ index: 1, title: 'Mixing colours' });
  });

  it('dispatches the skip action only when a marker is active', () => {
    const { c, media } = setup();
    c.dispatch({ type: 'skip' });
    expect(media.currentTime).toBe(0);
    at(media, 20);
    c.dispatch({ type: 'skip' });
    expect(media.currentTime).toBe(48);
  });
});
