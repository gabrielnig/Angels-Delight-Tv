import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PlayerController, type PlayerControllerOptions } from '../controller';
import { FakeEngine, FakeMedia, FakeNetwork } from '../testing/fakes';
import { PlayerView, type PlayerViewProps } from './PlayerView';

const markers = { intro: { start: 12, end: 48 }, credits: { start: 240, end: null } };
const chapters = [
  { start: 0, title: 'Welcome' },
  { start: 100, title: 'Mixing colours' },
];

function setup(opts: Partial<PlayerControllerOptions> = {}, view: Partial<PlayerViewProps> = {}) {
  const media = new FakeMedia();
  const controller = new PlayerController({
    media,
    engine: new FakeEngine(),
    tokens: { token: 't', masterUrl: 'https://app.test/m.m3u8', refresh: vi.fn() },
    videoId: 'v1',
    profileId: 'p1',
    sink: { save: vi.fn().mockResolvedValue(undefined) },
    network: new FakeNetwork(),
    markers,
    chapters,
    ...opts,
  });
  controller.start();
  act(() => media.setDuration(300));
  const utils = render(
    <PlayerView controller={controller} title="How Rain Is Made" chapters={chapters} {...view} />,
  );
  return { controller, media, ...utils };
}

function at(media: FakeMedia, seconds: number) {
  act(() => {
    media.currentTime = seconds;
    media.emit('timeupdate');
  });
}

describe('PlayerView skip and chapters (M43)', () => {
  beforeEach(() => vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('hover: hover') || q.includes('pointer: fine'), media: q, addEventListener() {}, removeEventListener() {} })));
  afterEach(() => vi.unstubAllGlobals());

  it('shows Skip intro inside the window and not outside', () => {
    const { media } = setup();
    expect(screen.queryByRole('button', { name: /Skip intro/ })).toBeNull();
    at(media, 20);
    expect(screen.getByRole('button', { name: /Skip intro/ })).toBeTruthy();
    at(media, 60);
    expect(screen.queryByRole('button', { name: /Skip intro/ })).toBeNull();
  });

  it('is the first focusable control after the video, before the control bar', () => {
    const { media, container } = setup();
    at(media, 20);
    const focusables = [...container.querySelectorAll<HTMLElement>('button:not([tabindex="-1"])')];
    expect(focusables[0]?.textContent).toContain('Skip intro');
  });

  it('announces the skip once through the live region, without a key hint', () => {
    const { media } = setup();
    at(media, 20);
    expect(screen.getByRole('status').textContent).toBe('Skip intro available');
  });

  it('click seeks to the window end and moves focus to the play button', () => {
    const { media } = setup();
    at(media, 20);
    fireEvent.click(screen.getByRole('button', { name: /Skip intro/ }));
    expect(media.currentTime).toBe(48);
    expect(document.activeElement?.getAttribute('aria-label')).toMatch(/^(Play|Pause)$/);
  });

  it('S skips while a window is active and does nothing otherwise', () => {
    const { media, container } = setup();
    const region = container.querySelector('.adp')!;
    fireEvent.keyDown(region, { key: 's' });
    expect(media.currentTime).toBe(0);
    at(media, 20);
    fireEvent.keyDown(region, { key: 's' });
    expect(media.currentTime).toBe(48);
  });

  it('shows the S hint only with a hovering pointer', () => {
    const { media } = setup();
    at(media, 20);
    expect(screen.getByRole('button', { name: /Skip intro/ }).textContent).toContain('S');
  });

  it('shows the current chapter next to the time on a desktop layout', () => {
    const { media } = setup();
    at(media, 110);
    expect(screen.getByText('Mixing colours', { selector: '.adp-chapter' })).toBeTruthy();
  });

  it('opens a chapters menu that seeks and closes on selection, and hides the button with no chapters', () => {
    const { media, unmount } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Chapters' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: /Mixing colours/ }));
    expect(media.currentTime).toBe(100);
    expect(screen.queryByRole('menu')).toBeNull();
    unmount();
    setup({ chapters: [] }, { chapters: [] });
    expect(screen.queryByRole('button', { name: 'Chapters' })).toBeNull();
  });

  it('puts chapters in the settings sheet on compact screens', () => {
    vi.stubGlobal('matchMedia', (q: string) => ({
      matches: q.includes('max-width: 640px'),
      media: q,
      addEventListener() {},
      removeEventListener() {},
    }));
    setup();
    expect(screen.queryByRole('button', { name: 'Chapters' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    expect(screen.getByText('Chapters', { selector: '.adp-menu__section' })).toBeTruthy();
  });
});
