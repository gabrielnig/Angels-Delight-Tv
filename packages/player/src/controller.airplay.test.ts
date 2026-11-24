import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PlayerController, type PlayerControllerOptions } from './controller';
import type { PlayerEngine } from './engine';
import { FakeEngine, FakeMedia, FakeNetwork } from './testing/fakes';

const MASTER = 'https://app.test/api/play/v1/master.m3u8';

function named(name: string): FakeEngine {
  return Object.assign(new FakeEngine(), { name }) as unknown as FakeEngine;
}

function setup(extra: Partial<PlayerControllerOptions> = {}, engineName = 'hls') {
  const media = new FakeMedia();
  const engine = named(engineName);
  const native = named('native');
  const order: string[] = [];
  const createNativeEngine = vi.fn((): PlayerEngine => {
    order.push('create');
    return native;
  });
  const showAirplayPicker = vi.fn(() => {
    order.push('picker');
    return true;
  });
  const c = new PlayerController({
    media,
    engine,
    tokens: { token: 'tok', masterUrl: MASTER, refresh: vi.fn() },
    videoId: 'v1',
    profileId: 'p1',
    sink: { save: vi.fn().mockResolvedValue(undefined) },
    network: new FakeNetwork(),
    createNativeEngine,
    showAirplayPicker,
    ...extra,
  });
  c.start();
  media.setDuration(300);
  media.emit('playing');
  engine.emit({ type: 'levels', heights: [360, 480, 720] });
  return { c, media, engine, native, order, createNativeEngine, showAirplayPicker };
}

describe('AirPlay engine switch (L4-10, R16)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('switches to the native engine at the current time before showing the picker', () => {
    const { c, media, engine, native, order } = setup();
    media.advance(40);
    c.openAirplay();
    expect(engine.destroyed).toBe(true);
    expect(native.loads[0]).toMatchObject({ src: MASTER, startPosition: 40 });
    expect(native.tokens).toContain('tok');
    expect(order).toEqual(['create', 'picker']);
  });

  it('keeps the position and play state through the switch', () => {
    const playing = setup();
    playing.media.advance(40);
    const before = playing.media.playCalls;
    playing.c.openAirplay();
    expect(playing.media.playCalls).toBe(before + 1);

    const paused = setup();
    paused.media.advance(40);
    paused.media.pause();
    const pausedBefore = paused.media.playCalls;
    paused.c.openAirplay();
    expect(paused.media.playCalls).toBe(pausedBefore);
    expect(paused.native.loads[0]?.startPosition).toBe(40);
  });

  it('does not switch when the engine is already native', () => {
    const { c, createNativeEngine, showAirplayPicker, engine } = setup({}, 'native');
    c.openAirplay();
    expect(createNativeEngine).not.toHaveBeenCalled();
    expect(engine.destroyed).toBe(false);
    expect(showAirplayPicker).toHaveBeenCalledTimes(1);
  });

  it('shows an error toast when the switch fails and keeps playing locally', () => {
    const { c, engine, showAirplayPicker, media } = setup({
      createNativeEngine: () => {
        throw new Error('no native');
      },
    });
    media.advance(40);
    c.openAirplay();
    expect(engine.destroyed).toBe(false);
    expect(showAirplayPicker).not.toHaveBeenCalled();
    expect(c.getState().toast).toMatchObject({
      kind: 'error',
      message: 'AirPlay could not start. Playing here.',
    });
    expect(media.paused).toBe(false);
    expect(c.getState().error).toBeNull();
  });

  it('hides the quality menu after the switch, because the native engine has no rungs', () => {
    const { c, media } = setup();
    expect(c.getState().quality.menu.visible).toBe(true);
    media.advance(10);
    c.openAirplay();
    expect(c.getState().quality.menu.visible).toBe(false);
  });

  it('listens to the new engine after the switch', () => {
    const { c, media, native } = setup();
    media.advance(10);
    c.openAirplay();
    native.emit({ type: 'error', error: { kind: 'gone', fatal: true, status: 404, detail: 'x' } });
    expect(c.getState().error).toBe('removed');
  });

  it('does nothing without a picker', () => {
    const { c, createNativeEngine } = setup({ showAirplayPicker: undefined });
    c.openAirplay();
    expect(createNativeEngine).not.toHaveBeenCalled();
  });

  it('tracks wireless playback for the surface text', () => {
    const { c } = setup();
    expect(c.getState().wireless).toBe(false);
    c.setWireless(true);
    expect(c.getState().wireless).toBe(true);
    c.setWireless(false);
    expect(c.getState().wireless).toBe(false);
  });

  it('destroys the engine it is using now when disposed', () => {
    const { c, media, native, engine } = setup();
    media.advance(10);
    c.openAirplay();
    engine.destroyed = false;
    c.dispose();
    expect(native.destroyed).toBe(true);
  });
});
