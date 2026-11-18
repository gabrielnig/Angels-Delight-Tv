import { describe, expect, it, vi } from 'vitest';
import { PlayerController, type PlayerControllerOptions } from './controller';
import { FakeEngine, FakeMedia, FakePage } from './testing/fakes';
import type { PlaybackTelemetry } from './types';

/** M08-S30 and M08-S01 edge: the controller feeds startup, playback time, stalls and errors to a telemetry sink. */

function telemetry(): PlaybackTelemetry & { calls: Record<string, unknown[][]> } {
  const calls: Record<string, unknown[][]> = {};
  const rec =
    (name: string) =>
    (...args: unknown[]) => {
      (calls[name] ??= []).push(args);
    };
  return {
    calls,
    onStartup: rec('startup'),
    onTimeUpdate: rec('time'),
    onPause: rec('pause'),
    onEnded: rec('ended'),
    onHide: rec('hide'),
    setHeight: rec('height'),
    onError: rec('error'),
  };
}

function setup(extra: Partial<PlayerControllerOptions> = {}) {
  const media = new FakeMedia();
  const engine = new FakeEngine();
  const page = new FakePage();
  const t = telemetry();
  const c = new PlayerController({
    media,
    engine,
    page,
    tokens: { token: 't', masterUrl: 'https://app.test/m.m3u8', refresh: vi.fn() },
    videoId: 'v1',
    profileId: 'p1',
    sink: { save: vi.fn().mockResolvedValue(undefined) },
    telemetry: t,
    ...extra,
  });
  c.start();
  media.setDuration(120);
  return { c, media, engine, page, t };
}

describe('playback telemetry', () => {
  it('reports startup time once, at the first frame', () => {
    const { media, t } = setup();
    expect(t.calls.startup).toHaveLength(1);
    expect(typeof t.calls.startup?.[0]?.[0]).toBe('number');
    media.emit('playing');
    expect(t.calls.startup).toHaveLength(1);
  });

  it('passes the playback position in milliseconds and whether it is playing', () => {
    const { media, t } = setup();
    media.advance(12.5);
    expect(t.calls.time?.at(-1)).toEqual([12_500, true]);
    media.pause();
    media.advance(13);
    expect(t.calls.time?.at(-1)).toEqual([13_000, false]);
  });

  it('reports pause, end and page hide', () => {
    const { media, page, t } = setup();
    media.pause();
    expect(t.calls.pause).toHaveLength(1);
    page.setHidden(true);
    expect(t.calls.hide).toHaveLength(1);
    media.finish();
    expect(t.calls.ended).toHaveLength(1);
  });

  it('reports the rendition height that is playing', () => {
    const { engine, t } = setup();
    engine.emit({ type: 'level', height: 480, bitrate: 900_000 });
    expect(t.calls.height).toEqual([[480]]);
  });

  it('reports error codes from our own taxonomy and never a message', () => {
    const { engine, t } = setup();
    engine.emit({
      type: 'error',
      error: { kind: 'gone', fatal: true, status: 404, detail: 'manifestLoadError secret detail' },
    });
    expect(t.calls.error).toEqual([['player.gone']]);
  });

  it('never lets a failing sink break playback', () => {
    const boom = () => {
      throw new Error('sink down');
    };
    const { media } = setup({
      telemetry: {
        onStartup: boom,
        onTimeUpdate: boom,
        onPause: boom,
        onEnded: boom,
        onHide: boom,
        setHeight: boom,
        onError: boom,
      },
    });
    expect(() => {
      media.advance(3);
      media.pause();
    }).not.toThrow();
  });
});
