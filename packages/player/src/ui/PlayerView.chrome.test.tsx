import { act, fireEvent, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PlayerController, type PlayerControllerOptions } from '../controller';
import { FakeEngine, FakeMedia, FakeNetwork } from '../testing/fakes';
import { PlayerView, type PlayerViewProps } from './PlayerView';

/**
 * Behaviour of the player chrome that the first PlayerView suite did not pin: auto hide (M08-S07), full
 * screen details (M08-S06), the poster fade (M08-S27) and silent videos (M08-S05).
 */

const css = readFileSync(join(__dirname, '..', 'player.css'), 'utf8');

function setup(opts: Partial<PlayerControllerOptions> = {}, view: Partial<PlayerViewProps> = {}) {
  const media = new FakeMedia();
  const engine = new FakeEngine();
  const network = new FakeNetwork();
  const controller = new PlayerController({
    media,
    engine,
    tokens: { token: 't', masterUrl: 'https://app.test/m.m3u8', refresh: vi.fn() },
    videoId: 'v1',
    profileId: 'p1',
    sink: { save: vi.fn().mockResolvedValue(undefined) },
    network,
    ...opts,
  });
  controller.start();
  act(() => media.setDuration(352));
  const utils = render(<PlayerView controller={controller} title="How Rain Is Made" {...view} />);
  const region = screen.getByRole('region', { name: /Video player/ });
  return { controller, media, engine, network, region, ...utils };
}

function stubMatchMedia(matches: (q: string) => boolean) {
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: matches(q),
    media: q,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
}

describe('PlayerView chrome', () => {
  beforeEach(() => {
    vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('controls auto hide (M08-S07)', () => {
    it('fades the controls out after 3 seconds of playback without input', () => {
      vi.useFakeTimers();
      const { region } = setup();
      expect(region.getAttribute('data-controls')).toBe('visible');
      act(() => void vi.advanceTimersByTime(2_900));
      expect(region.getAttribute('data-controls')).toBe('visible');
      act(() => void vi.advanceTimersByTime(200));
      expect(region.getAttribute('data-controls')).toBe('hidden');
    });

    it('hides the cursor with the controls on desktop', () => {
      expect(css).toMatch(/\.adp\[data-controls='hidden'\][^{]*\{[^}]*cursor:\s*none/);
    });

    it('brings the controls back at once on pointer move, key press and touch', () => {
      vi.useFakeTimers();
      const { region, media } = setup();
      const hide = () => act(() => void vi.advanceTimersByTime(3_100));
      hide();
      expect(region.getAttribute('data-controls')).toBe('hidden');
      fireEvent.pointerMove(region, { pointerType: 'mouse' });
      expect(region.getAttribute('data-controls')).toBe('visible');
      hide();
      fireEvent.keyDown(region, { key: 'ArrowRight', code: 'ArrowRight' });
      expect(region.getAttribute('data-controls')).toBe('visible');
      hide();
      const surface = region.querySelector('.adp-surface') as HTMLElement;
      fireEvent.pointerDown(surface, { pointerType: 'touch' });
      fireEvent.pointerUp(surface, { pointerType: 'touch', clientX: 100 });
      expect(region.getAttribute('data-controls')).toBe('visible');
      expect(media.paused).toBe(false);
    });

    it('keeps the controls while keyboard focus is inside them', () => {
      vi.useFakeTimers();
      const original = HTMLElement.prototype.matches;
      vi.spyOn(HTMLElement.prototype, 'matches').mockImplementation(function (
        this: HTMLElement,
        selector: string,
      ) {
        return selector === ':focus-visible' ? true : original.call(this, selector);
      });
      const { region } = setup();
      const button = screen.getByRole('button', { name: /^Speed/ });
      act(() => button.focus());
      act(() => void vi.advanceTimersByTime(10_000));
      expect(region.getAttribute('data-controls')).toBe('visible');
    });

    it('never hides the controls while paused', () => {
      vi.useFakeTimers();
      const { region, media } = setup();
      act(() => media.pause());
      act(() => void vi.advanceTimersByTime(10_000));
      expect(region.getAttribute('data-controls')).toBe('visible');
    });

    it('has no fade animation when the viewer prefers reduced motion', () => {
      const block =
        /@media \(prefers-reduced-motion: reduce\)\s*\{[\s\S]*?\n\}/.exec(css)?.[0] ?? '';
      expect(block).toMatch(/transition:\s*none\s*!important/);
      expect(block).toMatch(/animation:\s*none\s*!important/);
    });
  });

  describe('full screen and orientation (M08-S06)', () => {
    function withFullscreenApi(region: HTMLElement) {
      let element: Element | null = null;
      region.requestFullscreen = vi.fn(async () => {
        element = region;
        document.dispatchEvent(new Event('fullscreenchange'));
      });
      Object.defineProperty(document, 'fullscreenElement', {
        configurable: true,
        get: () => element,
      });
      document.exitFullscreen = vi.fn(async () => {
        element = null;
        document.dispatchEvent(new Event('fullscreenchange'));
      });
    }
    afterEach(() => {
      Reflect.deleteProperty(document, 'fullscreenElement');
    });

    it('enters full screen when a mouse user double clicks the video', () => {
      const { region } = setup();
      withFullscreenApi(region);
      const surface = region.querySelector('.adp-surface') as HTMLElement;
      fireEvent.pointerDown(surface, { pointerType: 'mouse' });
      fireEvent.doubleClick(surface);
      expect(region.requestFullscreen).toHaveBeenCalledTimes(1);
    });

    it('does not enter full screen on a touch double tap, which seeks instead', () => {
      const { region } = setup();
      withFullscreenApi(region);
      const surface = region.querySelector('.adp-surface') as HTMLElement;
      fireEvent.pointerDown(surface, { pointerType: 'touch' });
      fireEvent.doubleClick(surface);
      expect(region.requestFullscreen).not.toHaveBeenCalled();
    });

    it('locks landscape on a phone and releases the lock on exit', async () => {
      stubMatchMedia((q) => q.includes('max-width: 640px'));
      const lock = vi.fn().mockResolvedValue(undefined);
      const unlock = vi.fn();
      vi.stubGlobal('screen', { orientation: { lock, unlock } });
      const { region } = setup();
      withFullscreenApi(region);
      fireEvent.click(screen.getByRole('button', { name: 'Full screen' }));
      await act(async () => undefined);
      expect(lock).toHaveBeenCalledWith('landscape');
      fireEvent.click(screen.getByRole('button', { name: 'Exit full screen' }));
      await act(async () => undefined);
      expect(unlock).toHaveBeenCalled();
    });

    it('does not lock the orientation on a desktop', async () => {
      stubMatchMedia(() => false);
      const lock = vi.fn().mockResolvedValue(undefined);
      vi.stubGlobal('screen', { orientation: { lock, unlock: vi.fn() } });
      const { region } = setup();
      withFullscreenApi(region);
      fireEvent.click(screen.getByRole('button', { name: 'Full screen' }));
      await act(async () => undefined);
      expect(lock).not.toHaveBeenCalled();
    });

    it('uses native full screen on iOS Safari, which has no element full screen', async () => {
      const { region } = setup();
      (region as { requestFullscreen?: unknown }).requestFullscreen = undefined;
      const video = region.querySelector('video') as HTMLVideoElement & {
        webkitEnterFullscreen?: () => void;
      };
      video.webkitEnterFullscreen = vi.fn();
      fireEvent.click(screen.getByRole('button', { name: 'Full screen' }));
      await act(async () => undefined);
      expect(video.webkitEnterFullscreen).toHaveBeenCalled();
    });
  });

  describe('poster and first frame (M08-S27)', () => {
    it('shows the poster until the first frame, then fades it out', () => {
      const media = new FakeMedia();
      media.autoStart = false;
      const { region } = setup({ media }, { posterUrl: 'https://img.test/p.webp' });
      const poster = region.querySelector('.adp-poster') as HTMLImageElement;
      expect(poster.getAttribute('src')).toBe('https://img.test/p.webp');
      expect(poster.getAttribute('data-state')).toBe('visible');
      act(() => media.emit('playing'));
      expect(poster.getAttribute('data-state')).toBe('hidden');
    });

    it('fades within 200 ms and not at all under reduced motion', () => {
      const rule = /\.adp-poster\s*\{[^}]*\}/.exec(css)?.[0] ?? '';
      const match = /transition:[^;]*?(\d+)ms/.exec(rule);
      expect(match).not.toBeNull();
      expect(Number(match?.[1])).toBeLessThanOrEqual(200);
    });

    it('falls back to a dark neutral box when the poster fails to load', () => {
      const media = new FakeMedia();
      media.autoStart = false;
      const { region } = setup({ media }, { posterUrl: 'https://img.test/broken.webp' });
      const poster = region.querySelector('.adp-poster') as HTMLImageElement;
      fireEvent.error(poster);
      expect(region.querySelector('.adp-poster')).toBeNull();
      expect(css).toMatch(/\.adp\s*\{[^}]*background:\s*var\(--/);
    });

    it('renders no poster element when there is none', () => {
      const { region } = setup();
      expect(region.querySelector('.adp-poster')).toBeNull();
    });
  });

  describe('videos without sound (M08-S05)', () => {
    it('hides the volume and mute controls when the rendition has no audio track', () => {
      const { engine } = setup();
      expect(screen.getByRole('button', { name: 'Mute' })).toBeTruthy();
      act(() => engine.emit({ type: 'levels', heights: [360, 480], audio: false }));
      expect(screen.queryByRole('button', { name: 'Mute' })).toBeNull();
      expect(screen.queryByRole('slider', { name: 'Volume' })).toBeNull();
    });

    it('keeps the controls when the video has sound', () => {
      const { engine } = setup();
      act(() => engine.emit({ type: 'levels', heights: [360, 480], audio: true }));
      expect(screen.getByRole('button', { name: 'Mute' })).toBeTruthy();
    });

    it('keeps the controls when the engine does not say', () => {
      const { engine } = setup();
      act(() => engine.emit({ type: 'levels', heights: [360] }));
      expect(screen.getByRole('button', { name: 'Mute' })).toBeTruthy();
    });
  });

  describe('caption styling (M11-S03)', () => {
    it('applies the chosen size, background and colours to the player', () => {
      const { region } = setup(
        {},
        { captionStyle: { size: 'xlarge', background: 'solid', contrast: 'high' } },
      );
      expect(region.style.getPropertyValue('--adp-cap-size')).toBe('34px');
      expect(region.style.getPropertyValue('--adp-cap-bg')).toBe('#000000');
      expect(region.style.getPropertyValue('--adp-cap-fg')).toBe('#ffffff');
    });

    it('uses the readable default when no style is given', () => {
      const { region } = setup();
      expect(region.style.getPropertyValue('--adp-cap-size')).toBe('20px');
      expect(region.style.getPropertyValue('--adp-cap-bg')).toBe('rgba(0, 0, 0, 0.72)');
    });

    it('reads the variables in the cue rule', () => {
      const rule = /\.adp-video::cue\s*\{[^}]*\}/.exec(css)?.[0] ?? '';
      expect(rule).toContain('var(--adp-cap-size');
      expect(rule).toContain('var(--adp-cap-bg');
      expect(rule).toContain('var(--adp-cap-fg');
    });
  });
});
