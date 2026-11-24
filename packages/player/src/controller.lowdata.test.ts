import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PlayerController, type PlayerControllerOptions } from './controller';
import { FakeEngine, FakeMedia, FakeNetwork } from './testing/fakes';

function setup(extra: Partial<PlayerControllerOptions> = {}) {
  const media = new FakeMedia();
  const engine = new FakeEngine();
  const onPreferencesChange = vi.fn();
  const c = new PlayerController({
    media,
    engine,
    tokens: { token: 't', masterUrl: 'https://app.test/m.m3u8', refresh: vi.fn() },
    videoId: 'v1',
    profileId: 'p1',
    sink: { save: vi.fn().mockResolvedValue(undefined) },
    network: new FakeNetwork(),
    onPreferencesChange,
    ...extra,
  });
  c.start();
  media.setDuration(300);
  media.emit('playing');
  engine.emit({ type: 'levels', heights: [360, 480, 720] });
  return { c, media, engine, onPreferencesChange };
}

async function stall(media: FakeMedia, ms: number) {
  media.emit('waiting');
  await vi.advanceTimersByTimeAsync(ms);
}

describe('low data start and stall hints (L4-11)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  describe('start quality', () => {
    it('starts on the low rung under Save-Data', () => {
      const { engine } = setup({ hints: { saveData: true } });
      expect(engine.loads[0]?.lowData).toBe(true);
    });

    it.each(['slow-2g', '2g', '3g'])('starts on the low rung on %s', (effectiveType) => {
      const { engine } = setup({ hints: { effectiveType } });
      expect(engine.loads[0]?.lowData).toBe(true);
    });

    it('starts on the low rung when the downlink is under 1.5 Mbps', () => {
      expect(setup({ hints: { downlink: 1.2 } }).engine.loads[0]?.lowData).toBe(true);
      expect(setup({ hints: { downlink: 1.5 } }).engine.loads[0]?.lowData).toBe(false);
    });

    it('starts on 480p on a fast connection', () => {
      const { engine } = setup({ hints: { effectiveType: '4g', downlink: 10 } });
      expect(engine.loads[0]?.lowData).toBe(false);
    });
  });

  describe('locked quality', () => {
    it('shows the hint after 8 seconds of stall on a locked quality, with no Auto claim', async () => {
      const { c, media } = setup();
      c.selectQuality(720);
      await stall(media, 7_900);
      expect(c.getState().hint).toBeNull();
      await vi.advanceTimersByTimeAsync(200);
      expect(c.getState().hint).toMatchObject({ kind: 'locked-quality' });
      expect(c.getState().slowNotice).toBe(false);
    });

    it('clears the hint when playback resumes', async () => {
      const { c, media } = setup();
      c.selectQuality(720);
      await stall(media, 8_100);
      media.emit('playing');
      expect(c.getState().hint).toBeNull();
    });

    it('does not show it on Auto', async () => {
      const { c, media } = setup();
      await stall(media, 8_100);
      expect(c.getState().hint).toBeNull();
    });
  });

  describe('Data saver suggestion', () => {
    async function twoStalls(media: FakeMedia, gap = 10_000) {
      await stall(media, 1_000);
      media.emit('playing');
      await vi.advanceTimersByTimeAsync(gap);
      await stall(media, 1_000);
    }

    it('suggests Data saver after two stalls in 60 seconds on Auto', async () => {
      const { c, media } = setup();
      await stall(media, 1_000);
      media.emit('playing');
      expect(c.getState().hint).toBeNull();
      await twoStalls(media);
      expect(c.getState().hint).toMatchObject({ kind: 'data-saver' });
    });

    it('does not suggest when the stalls are more than 60 seconds apart', async () => {
      const { c, media } = setup();
      await twoStalls(media, 61_000);
      expect(c.getState().hint).toBeNull();
    });

    it('suggests only once per video', async () => {
      const { c, media } = setup();
      await twoStalls(media);
      c.dismissHint();
      expect(c.getState().hint).toBeNull();
      media.emit('playing');
      await twoStalls(media);
      expect(c.getState().hint).toBeNull();
    });

    it('does not suggest when Data saver is already on', async () => {
      const { c, media } = setup({ preferences: { dataSaver: true } });
      await twoStalls(media);
      expect(c.getState().hint).toBeNull();
    });

    it('does not suggest on a locked quality', async () => {
      const { c, media } = setup();
      c.selectQuality(480);
      await twoStalls(media);
      expect(c.getState().hint?.kind).not.toBe('data-saver');
    });

    it('Turn on sets the preference, caps to 360p and clears the hint', async () => {
      const { c, media, engine, onPreferencesChange } = setup();
      await twoStalls(media);
      c.enableDataSaver();
      expect(onPreferencesChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ dataSaver: true }),
      );
      expect(engine.qualityCalls.at(-1)).toMatchObject({ cap: 360 });
      expect(c.getState().hint).toBeNull();
    });
  });

  it('keeps the position when the viewer seeks during a stall', async () => {
    const { c, media } = setup();
    media.advance(40);
    await stall(media, 2_000);
    c.seekTo(100);
    expect(media.currentTime).toBe(100);
    expect(c.getState().error).toBeNull();
  });

  it('shows a failed Data saver save as a toast that stays until it is dismissed', async () => {
    const { c } = setup();
    c.notify('Could not save Data saver. It still applies to this video.', 'error', true);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(c.getState().toast).toMatchObject({
      kind: 'error',
      message: 'Could not save Data saver. It still applies to this video.',
    });
    c.dismissToast();
    expect(c.getState().toast).toBeNull();
  });

  it('a normal toast still goes away by itself', async () => {
    const { c } = setup();
    c.notify('Hello');
    await vi.advanceTimersByTimeAsync(6_100);
    expect(c.getState().toast).toBeNull();
  });
});
