import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PlayerController, type PlayerControllerOptions } from '../controller';
import type { CaptionTrack } from '../types';
import { SessionError } from '../token';
import { FakeEngine, FakeMedia, FakeNetwork } from '../testing/fakes';
import { PlayerView, type PlayerViewProps } from './PlayerView';

const en: CaptionTrack = {
  id: 'en',
  language: 'en',
  label: 'English',
  src: '/c/en.vtt',
  status: 'approved',
};
const yo: CaptionTrack = {
  id: 'yo',
  language: 'yo',
  label: 'Yoruba',
  src: '/c/yo.vtt',
  status: 'approved',
};
const next = { id: 'v2', title: 'Why the Sky Is Blue', meta: 'Everyday Science, S1 E4, 5 min' };

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
  const ui = userEvent.setup();
  const utils = render(<PlayerView controller={controller} title="How Rain Is Made" {...view} />);
  const region = screen.getByRole('region', { name: /Video player/ });
  return { controller, media, engine, network, ui, region, ...utils };
}

function stubMatchMedia(matches: (q: string) => boolean) {
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: matches(q),
    media: q,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
}

describe('PlayerView', () => {
  beforeEach(() => {
    vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('structure and accessibility', () => {
    it('is a labelled region with a named play control', () => {
      const { region } = setup();
      expect(region.getAttribute('aria-label')).toBe('Video player: How Rain Is Made');
      expect(screen.getByRole('button', { name: 'Pause' })).toBeTruthy();
    });

    it('keeps the tab order play, seek, time, volume, captions, speed, quality, full screen', () => {
      const { engine } = setup({ captions: [en] });
      act(() => engine.emit({ type: 'levels', heights: [360, 480, 720] }));
      const names = [
        ...screen
          .getByRole('region')
          .querySelectorAll<HTMLElement>('button, [role="slider"], input'),
      ]
        .filter((el) => el.closest('.adp-controls'))
        .map((el) => el.getAttribute('aria-label') ?? el.textContent ?? '');
      const order = ['Pause', 'Seek', 'Back 10 seconds', 'Forward 10 seconds', 'Mute', 'Volume'];
      expect(names.slice(0, order.length)).toEqual(order);
      const idx = (re: RegExp) => names.findIndex((n) => re.test(n));
      expect(idx(/^Time/)).toBeGreaterThan(idx(/^Volume/));
      expect(idx(/^Captions/)).toBeGreaterThan(idx(/^Time/));
      expect(idx(/^Speed/)).toBeGreaterThan(idx(/^Captions/));
      expect(idx(/^Quality/)).toBeGreaterThan(idx(/^Speed/));
      expect(idx(/full screen/i)).toBeGreaterThan(idx(/^Quality/));
    });

    it('exposes the seek bar as a slider with spoken value text', () => {
      const { media } = setup();
      act(() => media.advance(134));
      const slider = screen.getByRole('slider', { name: 'Seek' });
      expect(slider.getAttribute('aria-valuetext')).toBe(
        '2 minutes 14 seconds of 5 minutes 52 seconds',
      );
      expect(slider.getAttribute('aria-valuemax')).toBe('352');
    });

    it('announces state changes in a polite live region', () => {
      const { engine } = setup();
      engine.canDrop = false;
      act(() =>
        engine.emit({ type: 'error', error: { kind: 'network', fatal: true, detail: 'x' } }),
      );
      const live = document.querySelector('[aria-live="polite"]');
      expect(live?.textContent).toBe('Connection lost');
    });

    it('labels toggle buttons with their state', async () => {
      const { ui } = setup({ captions: [en] });
      const cc = screen.getByRole('button', { name: 'Captions' });
      expect(cc.getAttribute('aria-pressed')).toBe('false');
      await ui.click(cc);
      expect(cc.getAttribute('aria-pressed')).toBe('true');
      const mute = screen.getByRole('button', { name: 'Mute' });
      await ui.click(mute);
      expect(screen.getByRole('button', { name: 'Unmute' }).getAttribute('aria-pressed')).toBe(
        'true',
      );
    });
  });

  describe('playback controls', () => {
    it('toggles play and pause from the button', async () => {
      const { ui, media } = setup();
      await ui.click(screen.getByRole('button', { name: 'Pause' }));
      expect(media.paused).toBe(true);
      await ui.click(screen.getByRole('button', { name: 'Play' }));
      expect(media.paused).toBe(false);
    });

    it('seeks 10 seconds with the skip buttons', async () => {
      const { ui, media } = setup();
      act(() => media.advance(50));
      await ui.click(screen.getByRole('button', { name: 'Forward 10 seconds' }));
      expect(media.currentTime).toBe(60);
      await ui.click(screen.getByRole('button', { name: 'Back 10 seconds' }));
      expect(media.currentTime).toBe(50);
    });

    it('shows elapsed and total, and toggles to remaining', async () => {
      const { ui, media } = setup();
      act(() => media.advance(134));
      const t = screen.getByRole('button', { name: /^Time/ });
      expect(t.textContent).toBe('2:14 / 5:52');
      await ui.click(t);
      expect(t.textContent).toBe('-3:38 / 5:52');
    });

    it('shows the big play button while paused', () => {
      const { media } = setup();
      act(() => media.pause());
      expect(document.querySelector('.adp-bigplay')).not.toBeNull();
      act(() => (document.querySelector('.adp-bigplay') as HTMLElement).click());
      expect(media.paused).toBe(false);
    });

    it('pauses and plays when the video area is clicked with a mouse', () => {
      const { media, container } = setup();
      const surface = container.querySelector('.adp-surface') as HTMLElement;
      fireEvent.pointerDown(surface, { pointerType: 'mouse' });
      fireEvent.click(surface);
      expect(media.paused).toBe(true);
    });
  });

  describe('keyboard shortcuts', () => {
    it('handles the documented keys when the player has focus', async () => {
      const { ui, media, region } = setup({ captions: [en] });
      act(() => region.focus());
      await ui.keyboard('k');
      expect(media.paused).toBe(true);
      await ui.keyboard(' ');
      expect(media.paused).toBe(false);
      act(() => media.advance(100));
      await ui.keyboard('{ArrowRight}');
      expect(media.currentTime).toBe(105);
      await ui.keyboard('j');
      expect(media.currentTime).toBe(95);
      await ui.keyboard('5');
      expect(media.currentTime).toBeCloseTo(176);
      await ui.keyboard('m');
      expect(media.muted).toBe(true);
      await ui.keyboard('c');
      expect(screen.getByRole('button', { name: 'Captions' }).getAttribute('aria-pressed')).toBe(
        'true',
      );
      await ui.keyboard('{ArrowDown}');
      expect(media.volume).toBe(0.95);
    });

    it('does not toggle play twice when Space presses a focused button', async () => {
      const { ui, media } = setup();
      const mute = screen.getByRole('button', { name: 'Mute' });
      act(() => mute.focus());
      await ui.keyboard(' ');
      expect(media.muted).toBe(true);
      expect(media.paused).toBe(false);
    });

    it('opens the shortcuts dialog with ?, traps focus and closes with Escape', async () => {
      const { ui, region } = setup();
      act(() => region.focus());
      await ui.keyboard('?');
      const dialog = screen.getByRole('dialog', { name: 'Keyboard shortcuts' });
      expect(dialog.getAttribute('aria-modal')).toBe('true');
      expect(within(dialog).getByText('Play or pause')).toBeTruthy();
      const close = within(dialog).getByRole('button', { name: 'Close' });
      expect(document.activeElement).toBe(close);
      await ui.tab();
      expect(document.activeElement).toBe(close);
      await ui.keyboard('{Escape}');
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('ignores shortcuts typed into inputs', async () => {
      const { ui, media } = setup();
      const volume = screen.getByRole('slider', { name: 'Volume' });
      act(() => volume.focus());
      await ui.keyboard('k');
      expect(media.paused).toBe(false);
    });

    it('stops the autoplay countdown on any key', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const { media, region, controller } = setup(
        { upNext: next, preferences: { autoplayNext: true } },
        { next },
      );
      act(() => media.finish());
      expect(controller.getState().upNext.countdown).toBe(5);
      act(() => region.focus());
      fireEvent.keyDown(region, { key: 'x' });
      expect(controller.getState().upNext.countdown).toBeNull();
      vi.useRealTimers();
    });
  });

  describe('menus', () => {
    it('opens the speed menu as radio items, applies a choice and returns focus', async () => {
      const { ui, media } = setup();
      const button = screen.getByRole('button', { name: 'Speed' });
      await ui.click(button);
      const menu = screen.getByRole('menu', { name: 'Speed' });
      const rows = within(menu).getAllByRole('menuitemradio');
      expect(rows.map((r) => r.textContent)).toEqual([
        '0.5x',
        '0.75x',
        'Normal',
        '1.25x',
        '1.5x',
        '2x',
      ]);
      expect(
        within(menu).getByRole('menuitemradio', { name: 'Normal' }).getAttribute('aria-checked'),
      ).toBe('true');
      await ui.click(within(menu).getByRole('menuitemradio', { name: '1.5x' }));
      expect(media.playbackRate).toBe(1.5);
      expect(screen.queryByRole('menu')).toBeNull();
      expect(document.activeElement).toBe(button);
    });

    it('closes a menu with Escape and returns focus to its button', async () => {
      const { ui } = setup();
      const button = screen.getByRole('button', { name: 'Speed' });
      await ui.click(button);
      await ui.keyboard('{Escape}');
      expect(screen.queryByRole('menu')).toBeNull();
      expect(document.activeElement).toBe(button);
    });

    it('moves between rows with the arrow keys', async () => {
      const { ui } = setup();
      await ui.click(screen.getByRole('button', { name: 'Speed' }));
      expect(document.activeElement?.textContent).toBe('Normal');
      await ui.keyboard('{ArrowDown}');
      expect(document.activeElement?.textContent).toBe('1.25x');
    });

    it('lists only the renditions that exist, with Auto and the current level', async () => {
      const { ui, engine } = setup();
      act(() => {
        engine.emit({ type: 'levels', heights: [360, 480, 720] });
        engine.emit({ type: 'level', height: 720 });
      });
      await ui.click(screen.getByRole('button', { name: 'Quality, Auto' }));
      const menu = screen.getByRole('menu', { name: 'Quality' });
      const names = within(menu)
        .getAllByRole('menuitemradio')
        .map((r) => r.getAttribute('aria-label'));
      expect(names).toEqual(['Auto, 720p now', '720p', '480p', '360p']);
      await ui.click(within(menu).getByRole('menuitemradio', { name: '480p' }));
      expect(engine.qualityCalls.at(-1)).toEqual({ selection: 480, cap: null });
      expect(screen.getByRole('button', { name: 'Quality, 480p' })).toBeTruthy();
    });

    it('disables higher rungs under data saver and explains why', async () => {
      const { ui, engine } = setup(
        { preferences: { dataSaver: true } },
        { links: { playbackSettings: '/account/playback' } },
      );
      act(() => engine.emit({ type: 'levels', heights: [360, 480, 720] }));
      await ui.click(screen.getByRole('button', { name: /^Quality/ }));
      const menu = screen.getByRole('menu', { name: 'Quality' });
      const high = within(menu).getByRole('menuitemradio', { name: /^720p/ });
      expect(high.getAttribute('aria-disabled')).toBe('true');
      expect(high.getAttribute('aria-label')).toContain(
        'Turn off Data saver to use higher quality',
      );
      expect(within(menu).getByText(/Data saver is on/)).toBeTruthy();
      expect(
        within(menu)
          .getByRole('link', { name: /Playback settings/ })
          .getAttribute('href'),
      ).toBe('/account/playback');
      await ui.click(high);
      expect(engine.qualityCalls.at(-1)).toBeUndefined();
    });

    it('hides the quality menu for a single rendition', () => {
      const { engine } = setup();
      act(() => engine.emit({ type: 'levels', heights: [360] }));
      expect(screen.queryByRole('button', { name: /^Quality/ })).toBeNull();
    });

    it('shows a caption language menu only when several approved languages exist', async () => {
      const { ui, controller } = setup({ captions: [en, yo] });
      const button = screen.getByRole('button', { name: 'Captions, off' });
      await ui.click(button);
      const menu = screen.getByRole('menu', { name: 'Captions' });
      expect(
        within(menu)
          .getAllByRole('menuitemradio')
          .map((r) => r.textContent),
      ).toEqual(['Off', 'English', 'Yoruba']);
      await ui.click(within(menu).getByRole('menuitemradio', { name: 'Yoruba' }));
      expect(controller.getState().captions.active).toBe('yo');
    });
  });

  describe('captions', () => {
    it('hides the CC button when there is no approved track', () => {
      setup({ captions: [{ ...en, status: 'needs_review' }] });
      expect(screen.queryByRole('button', { name: /^Captions/ })).toBeNull();
    });

    it('attaches only approved tracks as track elements', () => {
      const { container } = setup({ captions: [en, { ...yo, status: 'needs_review' }] });
      const tracks = [...container.querySelectorAll('track')];
      expect(tracks.map((t) => t.getAttribute('id'))).toEqual(['en']);
      expect(tracks[0]?.getAttribute('kind')).toBe('captions');
    });
  });

  describe('error and network states', () => {
    const cases: Array<[string, (s: ReturnType<typeof setup>) => void, RegExp, RegExp]> = [
      [
        'connection lost',
        ({ engine, media }) => {
          engine.canDrop = false;
          media.currentTime = 134;
          engine.emit({ type: 'error', error: { kind: 'network', fatal: true, detail: 'x' } });
        },
        /Connection lost/,
        /We will keep your place at 2:14/,
      ],
      [
        'removed',
        ({ engine }) =>
          engine.emit({ type: 'error', error: { kind: 'gone', fatal: true, detail: 'x' } }),
        /This video is no longer available/,
        /It may have been taken down/,
      ],
      [
        'cannot play',
        ({ media }) => {
          media.emit('error');
          media.emit('error');
        },
        /This video cannot play on this device/,
        /Reference/,
      ],
      [
        'unsupported browser',
        ({ engine }) =>
          engine.emit({ type: 'error', error: { kind: 'unsupported', fatal: true, detail: 'x' } }),
        /This browser cannot play this video/,
        /recent version/,
      ],
    ];
    for (const [name, trigger, title, body] of cases) {
      it(`shows the ${name} overlay`, () => {
        const s = setup({}, { reference: '9C2D7WA' });
        act(() => trigger(s));
        const alert = screen.getByRole('alert');
        expect(alert.textContent).toMatch(title);
        expect(alert.textContent).toMatch(body);
      });
    }

    it('retries from the connection lost overlay', async () => {
      const { ui, engine, media } = setup();
      engine.canDrop = false;
      act(() =>
        engine.emit({ type: 'error', error: { kind: 'network', fatal: true, detail: 'x' } }),
      );
      await ui.click(screen.getByRole('button', { name: 'Retry' }));
      expect(engine.recovers).toBe(1);
      expect(screen.queryByRole('alert')).toBeNull();
      expect(media.paused).toBe(false);
    });

    it('shows the offline overlay with Try again', () => {
      const { network, media } = setup();
      act(() => {
        network.set(false);
        media.emit('waiting');
      });
      const alert = screen.getByRole('alert');
      expect(alert.textContent).toMatch(/You are offline/);
      expect(within(alert).getByRole('button', { name: 'Try again' })).toBeTruthy();
    });

    it('shows Sign in again as a link when a sign in url is known', () => {
      const { media, controller } = setup({}, { links: { signIn: '/signin?next=/watch/v1' } });
      act(() => {
        media.bufferedRanges = [[0, 10]];
        controller.handleSessionFailure(new SessionError('auth'));
        media.advance(9.9);
      });
      const alert = screen.getByRole('alert');
      expect(alert.textContent).toMatch(/Sign in again to keep watching/);
      expect(within(alert).getByRole('link', { name: 'Sign in' }).getAttribute('href')).toBe(
        '/signin?next=/watch/v1',
      );
    });

    it('offers Resume after the network returns for a paused viewer', () => {
      const { network, media, controller } = setup();
      act(() => {
        media.pause();
        network.set(false);
        media.emit('waiting');
        network.set(true);
      });
      expect(controller.getState().backOnline).toBe(true);
      expect(screen.getByText('Back online.')).toBeTruthy();
      act(() => screen.getByRole('button', { name: 'Resume' }).click());
      expect(media.paused).toBe(false);
    });

    it('shows the resume toast with Start over', async () => {
      const { ui, media, controller } = setup({ resume: { saved: 134, duration: 352 } });
      expect(screen.getByText('Resumed from 2:14')).toBeTruthy();
      act(() => media.advance(131));
      await ui.click(screen.getByRole('button', { name: 'Start over' }));
      expect(media.currentTime).toBe(0);
      expect(controller.getState().toast).toBeNull();
    });

    it('shows a toast when captions fail to load', () => {
      const { controller } = setup({ captions: [en] });
      act(() => controller.captionFailed('en'));
      expect(screen.getByRole('alert').textContent).toMatch(/Captions could not load/);
    });
  });

  describe('up next and end screen', () => {
    it('slides in the next tile in the last 15 seconds and lets it be dismissed', async () => {
      const { ui, media } = setup({ upNext: next }, { next });
      act(() => media.advance(340));
      expect(screen.getByText('Why the Sky Is Blue')).toBeTruthy();
      await ui.click(screen.getByRole('button', { name: 'Dismiss next video' }));
      expect(screen.queryByText('Why the Sky Is Blue')).toBeNull();
    });

    it('shows the countdown card with Play now and Cancel', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const onNext = vi.fn();
      const { media, controller } = setup(
        { upNext: next, preferences: { autoplayNext: true }, onNext },
        { next, autoplayNext: true },
      );
      act(() => media.finish());
      expect(screen.getByText('Up next in 5 seconds')).toBeTruthy();
      expect(screen.getByText('Everyday Science, S1 E4, 5 min')).toBeTruthy();
      expect(document.querySelector('[aria-live="polite"]')?.textContent).toBe(
        'Next video starts in 5 seconds',
      );
      act(() => screen.getByRole('button', { name: 'Cancel' }).click());
      expect(controller.getState().upNext.cancelled).toBe(true);
      expect(document.querySelector('.adp-end__kicker')?.textContent).toBe('Autoplay cancelled');
      act(() => screen.getByRole('button', { name: /Play next/ }).click());
      expect(onNext).toHaveBeenCalledWith(next);
      vi.useRealTimers();
    });

    it('shows the autoplay off card without a countdown', () => {
      const { media } = setup(
        { upNext: next },
        {
          next,
          autoplayNext: false,
          end: { related: [{ ...next, id: 'r1', title: 'Rain', href: '/title/r1' }] },
        },
      );
      act(() => media.finish());
      expect(screen.getByText('Autoplay is off')).toBeTruthy();
      expect(screen.getByText('Next: Why the Sky Is Blue')).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Replay' })).toBeTruthy();
      expect(screen.getByRole('link', { name: 'Rain' }).getAttribute('href')).toBe('/title/r1');
    });

    it('shows You finished for the last episode of a series', () => {
      const { media } = setup(
        {},
        {
          end: {
            seriesTitle: 'Everyday Science',
            lastInSeries: true,
            backHref: '/series/es',
            browseHref: '/browse',
          },
        },
      );
      act(() => media.finish());
      expect(screen.getByText('You finished Everyday Science')).toBeTruthy();
      expect(screen.getByRole('link', { name: 'Back to the series' }).getAttribute('href')).toBe(
        '/series/es',
      );
      expect(screen.getByRole('link', { name: 'Browse more' })).toBeTruthy();
    });

    it('shows Thanks for watching with Replay, Add to My List and Back to Home', async () => {
      const add = vi.fn();
      const { media, ui } = setup({}, { end: { onAddToList: add, homeHref: '/' } });
      act(() => media.finish());
      expect(screen.getByText('Thanks for watching')).toBeTruthy();
      await ui.click(screen.getByRole('button', { name: /Add to My List/ }));
      expect(add).toHaveBeenCalled();
      expect(screen.getByRole('link', { name: 'Back to Home' }).getAttribute('href')).toBe('/');
      await ui.click(screen.getByRole('button', { name: 'Replay' }));
      expect(media.currentTime).toBe(0);
      expect(screen.queryByText('Thanks for watching')).toBeNull();
    });
  });

  describe('touch gestures', () => {
    it('double tap on the right third seeks forward and shows +10', () => {
      const { media, container } = setup();
      act(() => media.advance(50));
      const surface = container.querySelector('.adp-surface') as HTMLElement;
      vi.spyOn(surface, 'getBoundingClientRect').mockReturnValue({
        left: 0,
        width: 300,
        top: 0,
        height: 170,
        right: 300,
        bottom: 170,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      });
      for (let i = 0; i < 2; i++) {
        fireEvent.pointerDown(surface, { pointerType: 'touch', clientX: 260 });
        fireEvent.pointerUp(surface, { pointerType: 'touch', clientX: 260 });
      }
      expect(media.currentTime).toBe(60);
      expect(screen.getByText('+10')).toBeTruthy();
    });
  });

  describe('compact layout', () => {
    it('folds speed and quality into one settings sheet on phones, without a volume slider', async () => {
      stubMatchMedia((q) => q.includes('max-width'));
      const { ui, engine, media } = setup();
      act(() => engine.emit({ type: 'levels', heights: [360, 480, 720] }));
      expect(screen.queryByRole('button', { name: 'Speed' })).toBeNull();
      expect(screen.queryByRole('slider', { name: 'Volume' })).toBeNull();
      expect(screen.getByRole('button', { name: 'Mute' })).toBeTruthy();
      await ui.click(screen.getByRole('button', { name: 'Settings' }));
      const menu = screen.getByRole('menu', { name: 'Settings' });
      expect(within(menu).getByText('Speed')).toBeTruthy();
      expect(within(menu).getByText('Quality')).toBeTruthy();
      await ui.click(within(menu).getByRole('menuitemradio', { name: '1.25x' }));
      expect(media.playbackRate).toBe(1.25);
    });
  });

  describe('full screen', () => {
    it('toggles with the button and tells the viewer when it is refused', async () => {
      const { ui, region, controller } = setup();
      region.requestFullscreen = vi.fn().mockRejectedValue(new Error('denied'));
      await ui.click(screen.getByRole('button', { name: 'Full screen' }));
      expect(controller.getState().toast?.message).toBe(
        'Full screen is not available on this device',
      );
    });
  });
});
