import { act, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HeroPreview } from './HeroPreview';

const play = vi.fn().mockResolvedValue(undefined);
const pause = vi.fn();
beforeEach(() => {
  vi.useFakeTimers();
  play.mockClear();
  pause.mockClear();
  Object.defineProperty(HTMLMediaElement.prototype, 'play', { configurable: true, value: play });
  Object.defineProperty(HTMLMediaElement.prototype, 'pause', { configurable: true, value: pause });
});
afterEach(() => vi.useRealTimers());

const video = (c: HTMLElement) => c.querySelector('video');
const wait = (ms: number) => act(() => void vi.advanceTimersByTime(ms));

describe('HeroPreview', () => {
  it('renders no video at all when it is not active', () => {
    const { container } = render(<HeroPreview src="/c.mp4" active={false} paused={false} />);
    expect(video(container)).toBeNull();
  });

  it('sets the source only after the delay, with nothing preloaded before', () => {
    const { container } = render(<HeroPreview src="/c.mp4" active paused={false} />);
    expect(video(container)?.getAttribute('src')).toBeNull();
    expect(video(container)?.getAttribute('preload')).toBe('none');
    wait(1199);
    expect(video(container)?.getAttribute('src')).toBeNull();
    wait(1);
    expect(video(container)?.getAttribute('src')).toBe('/c.mp4');
  });

  it('is silent, decorative and has no controls', () => {
    const { container } = render(<HeroPreview src="/c.mp4" active paused={false} />);
    const v = video(container)!;
    expect(v.muted).toBe(true);
    expect(v.getAttribute('aria-hidden')).toBe('true');
    expect(v.hasAttribute('controls')).toBe(false);
    expect(v.hasAttribute('loop')).toBe(false);
  });

  it('fades in on playing and back to the still at the end', () => {
    const { container } = render(<HeroPreview src="/c.mp4" active paused={false} />);
    wait(1200);
    const v = video(container)!;
    expect(v.getAttribute('data-playing')).toBe('false');
    fireEvent.playing(v);
    expect(v.getAttribute('data-playing')).toBe('true');
    fireEvent.ended(v);
    expect(v.getAttribute('data-playing')).toBe('false');
  });

  it('removes the clip on error and on a two second stall', () => {
    const a = render(<HeroPreview src="/c.mp4" active paused={false} />);
    wait(1200);
    fireEvent.error(video(a.container)!);
    expect(video(a.container)).toBeNull();
    a.unmount();
    const b = render(<HeroPreview src="/c.mp4" active paused={false} />);
    wait(1200);
    fireEvent.stalled(video(b.container)!);
    wait(2000);
    expect(video(b.container)).toBeNull();
  });

  it('keeps a stall that recovers', () => {
    const { container } = render(<HeroPreview src="/c.mp4" active paused={false} />);
    wait(1200);
    fireEvent.stalled(video(container)!);
    wait(1000);
    fireEvent.playing(video(container)!);
    wait(2000);
    expect(video(container)).not.toBeNull();
  });

  it('pauses with the carousel and resumes', () => {
    const { container, rerender } = render(<HeroPreview src="/c.mp4" active paused={false} />);
    wait(1200);
    fireEvent.playing(video(container)!);
    rerender(<HeroPreview src="/c.mp4" active paused />);
    expect(pause).toHaveBeenCalled();
    rerender(<HeroPreview src="/c.mp4" active paused={false} />);
    expect(play).toHaveBeenCalled();
  });

  it('unloads when the slide stops being active', () => {
    const { container, rerender } = render(<HeroPreview src="/c.mp4" active paused={false} />);
    wait(1200);
    rerender(<HeroPreview src="/c.mp4" active={false} paused={false} />);
    expect(video(container)).toBeNull();
  });
});
