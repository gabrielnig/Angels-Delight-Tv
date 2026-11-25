import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Hero, type HeroItem } from './Hero';
import { heroSound, resetHeroSound } from './hero-sound';

const play = vi.fn().mockResolvedValue(undefined);
beforeEach(() => {
  vi.useFakeTimers();
  resetHeroSound();
  play.mockClear();
  play.mockResolvedValue(undefined);
  Object.defineProperty(HTMLMediaElement.prototype, 'play', { configurable: true, value: play });
  Object.defineProperty(HTMLMediaElement.prototype, 'pause', { configurable: true, value: vi.fn() });
});
afterEach(() => {
  vi.useRealTimers();
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
});

const slide = (id: string, extra: Partial<HeroItem> = {}): HeroItem => ({
  id,
  title: `Title ${id}`,
  description: `About ${id}`,
  playHref: `/watch/${id}`,
  infoHref: `/title/${id}`,
  ...extra,
});
const loud = (id: string) => slide(id, { previewSrc: `/${id}.mp4`, previewMs: 20_000, previewHasAudio: true });
const silent = (id: string) => slide(id, { previewSrc: `/${id}.mp4`, previewMs: 20_000, previewHasAudio: false });
const tick = (ms: number) => act(() => void vi.advanceTimersByTime(ms));
const unmute = () => screen.queryByRole('button', { name: /(Unmute|Mute) preview sound/ });
const show = (items: HeroItem[], extra: Record<string, unknown> = {}) =>
  render(<Hero items={items} label="Featured" intervalMs={20_000} previewAllowed soundAllowed {...extra} />);

describe('Hero sound button (M41-S22, D-367)', () => {
  it('shows Unmute beside Pause for a clip with sound, with the word, 44 px class and aria-pressed false', () => {
    show([loud('a'), loud('b')]);
    const button = unmute()!;
    expect(button).toHaveAccessibleName('Unmute preview sound');
    expect(button).toHaveTextContent('Unmute');
    expect(button).toHaveAttribute('type', 'button');
    expect(button).toHaveAttribute('aria-pressed', 'false');
    expect(button.className).toContain('ad-hero__sound');
    const pause = screen.getByRole('button', { name: 'Pause rotation' });
    expect(button.compareDocumentPosition(pause) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('starts muted and autoplays muted', () => {
    const { container } = show([loud('a'), loud('b')]);
    tick(1200);
    expect(container.querySelector('video')!.muted).toBe(true);
    expect(play).toHaveBeenCalled();
  });

  it('turns sound on with a click, reads Mute, and says Sound on politely', () => {
    const { container } = show([loud('a'), loud('b')]);
    tick(1200);
    fireEvent.click(unmute()!);
    const button = unmute()!;
    expect(button).toHaveAccessibleName('Mute preview sound');
    expect(button).toHaveTextContent('Mute');
    expect(button).toHaveAttribute('aria-pressed', 'true');
    expect(container.querySelector('video')!.muted).toBe(false);
    expect(screen.getByRole('status')).toHaveTextContent('Sound on');
    fireEvent.click(button);
    expect(container.querySelector('video')!.muted).toBe(true);
    expect(screen.getByRole('status')).toHaveTextContent('Sound off');
  });

  it('is keyboard operable and keeps the R37 focus class off inline styles', () => {
    show([loud('a'), loud('b')]);
    const button = unmute()!;
    button.focus();
    expect(document.activeElement).toBe(button);
    fireEvent.keyDown(button, { key: 'Enter' });
    expect(button.tagName).toBe('BUTTON');
    expect(button.getAttribute('style')).toBeNull();
  });

  it('the next clip follows the choice, and the button stays Mute', () => {
    const { container } = show([loud('a'), loud('b')]);
    tick(1200);
    fireEvent.click(unmute()!);
    fireEvent.click(screen.getByRole('button', { name: 'Next slide' }));
    tick(1200);
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Title b');
    expect(container.querySelector('video')!.muted).toBe(false);
    expect(unmute()).toHaveAttribute('aria-pressed', 'true');
  });

  it('is not offered for a clip made before sound existed, and the slot keeps the controls still', () => {
    const { container } = show([silent('a'), loud('b')]);
    expect(unmute()).toBeNull();
    expect(container.querySelector('.ad-hero__sound-slot')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Next slide' }));
    expect(unmute()).not.toBeNull();
  });

  it('is not offered when no slide has sound, so there is no empty slot', () => {
    const { container } = show([silent('a'), silent('b')]);
    expect(unmute()).toBeNull();
    expect(container.querySelector('.ad-hero__sound-slot')).toBeNull();
  });

  it('is never offered without the page permission (kids, site switch off)', () => {
    show([loud('a'), loud('b')], { soundAllowed: false });
    expect(unmute()).toBeNull();
  });

  it('is not offered when previews are not allowed (Data saver, slow link) or the clip failed', () => {
    const off = show([loud('a'), loud('b')], { previewAllowed: false });
    expect(unmute()).toBeNull();
    off.unmount();
    const { container } = show([loud('a'), loud('b')]);
    tick(1200);
    fireEvent.error(container.querySelector('video')!);
    expect(unmute()).toBeNull();
  });

  it('is never offered under reduced motion', () => {
    const original = window.matchMedia;
    window.matchMedia = ((query: string) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    })) as unknown as typeof window.matchMedia;
    try {
      show([loud('a'), loud('b')]);
      expect(unmute()).toBeNull();
    } finally {
      window.matchMedia = original;
    }
  });

  it('stops the sound when the tab hides and starts muted when it returns', () => {
    show([loud('a'), loud('b')]);
    tick(1200);
    fireEvent.click(unmute()!);
    expect(heroSound.get()).toBe(true);
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    act(() => void document.dispatchEvent(new Event('visibilitychange')));
    expect(heroSound.get()).toBe(false);
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    act(() => void document.dispatchEvent(new Event('visibilitychange')));
    expect(unmute()).toHaveAttribute('aria-pressed', 'false');
  });

  it('goes back to Unmute when the browser refuses sound for a new clip', async () => {
    show([loud('a'), loud('b')]);
    tick(1200);
    fireEvent.click(unmute()!);
    play.mockRejectedValueOnce(new DOMException('blocked', 'NotAllowedError'));
    fireEvent.click(screen.getByRole('button', { name: 'Next slide' }));
    tick(1200);
    await act(async () => {
      await Promise.resolve();
    });
    expect(unmute()).toHaveAttribute('aria-pressed', 'false');
    expect(heroSound.get()).toBe(false);
  });

  it('keeps Pause: pausing leaves the sound button usable', () => {
    show([loud('a'), loud('b')]);
    fireEvent.click(screen.getByRole('button', { name: 'Pause rotation' }));
    expect(screen.getByRole('button', { name: 'Resume rotation' })).toBeInTheDocument();
    expect(unmute()).not.toBeNull();
  });

  it('offers sound on a single slide with a clip, with no dots and no Pause', () => {
    show([loud('a')]);
    expect(unmute()).not.toBeNull();
    expect(screen.queryByRole('button', { name: /Pause rotation/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Show slide/ })).toBeNull();
  });
});
