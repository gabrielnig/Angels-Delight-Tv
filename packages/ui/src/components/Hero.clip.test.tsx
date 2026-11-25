import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Hero, type HeroItem } from './Hero';

const play = vi.fn().mockResolvedValue(undefined);
beforeEach(() => {
  vi.useFakeTimers();
  Object.defineProperty(HTMLMediaElement.prototype, 'play', { configurable: true, value: play });
  Object.defineProperty(HTMLMediaElement.prototype, 'pause', { configurable: true, value: vi.fn() });
});
afterEach(() => vi.useRealTimers());

/** No artwork, so the clock starts at once and the tests do not wait for an image. */
const slide = (id: string, extra: Partial<HeroItem> = {}): HeroItem => ({
  id,
  title: `Title ${id}`,
  description: `About ${id}`,
  playHref: `/watch/${id}`,
  infoHref: `/title/${id}`,
  ...extra,
});
const withClips = [
  slide('a', { previewSrc: '/a.mp4', previewMs: 20_000 }),
  slide('b', { previewSrc: '/b.mp4', previewMs: 20_000 }),
];
const tick = (ms: number) => act(() => void vi.advanceTimersByTime(ms));
const heading = () => screen.getByRole('heading', { level: 2 }).textContent;
const section = (c: HTMLElement) => c.querySelector('section.ad-hero') as HTMLElement;

describe('Hero timing with a clip (D-351, D-366)', () => {
  it('keeps a slide with a playing clip past the dwell time and moves on when the clip ends', () => {
    const { container } = render(
      <Hero items={withClips} label="Featured" intervalMs={20_000} previewAllowed />,
    );
    tick(1200);
    const video = container.querySelector('video')!;
    fireEvent.playing(video);
    tick(20_000 - 1200);
    expect(heading()).toBe('Title a');
    tick(1000);
    fireEvent.ended(video);
    expect(heading()).toBe('Title b');
  });

  it('moves on at the ceiling when the clip never ends', () => {
    render(<Hero items={withClips} label="Featured" intervalMs={20_000} previewAllowed />);
    tick(23_199);
    expect(heading()).toBe('Title a');
    tick(1);
    expect(heading()).toBe('Title b');
  });

  it('changes at the dwell time when the setting says the dwell decides', () => {
    const { container } = render(
      <Hero items={withClips} label="Featured" intervalMs={20_000} previewAllowed waitForClip={false} />,
    );
    tick(1200);
    fireEvent.playing(container.querySelector('video')!);
    tick(18_800);
    expect(heading()).toBe('Title b');
  });

  it('ignores the end of a clip when the dwell decides', () => {
    const { container } = render(
      <Hero items={withClips} label="Featured" intervalMs={20_000} previewAllowed waitForClip={false} />,
    );
    tick(1200);
    const video = container.querySelector('video')!;
    fireEvent.playing(video);
    fireEvent.ended(video);
    expect(heading()).toBe('Title a');
  });

  it('uses the dwell time for a slide that has no clip', () => {
    render(
      <Hero
        items={[slide('a'), slide('b', { previewSrc: '/b.mp4', previewMs: 20_000 })]}
        label="Featured"
        intervalMs={20_000}
        previewAllowed
      />,
    );
    tick(20_000);
    expect(heading()).toBe('Title b');
  });

  it('uses the dwell time when previews are not allowed', () => {
    render(<Hero items={withClips} label="Featured" intervalMs={20_000} />);
    tick(20_000);
    expect(heading()).toBe('Title b');
  });

  it('falls back to the dwell time when the clip fails', () => {
    const { container } = render(
      <Hero items={withClips} label="Featured" intervalMs={20_000} previewAllowed />,
    );
    tick(1500);
    fireEvent.error(container.querySelector('video')!);
    tick(19_999);
    expect(heading()).toBe('Title a');
    tick(1);
    expect(heading()).toBe('Title b');
  });

  it('does not move on when the clip ends while Pause is on', () => {
    const { container } = render(
      <Hero items={withClips} label="Featured" intervalMs={20_000} previewAllowed />,
    );
    tick(1200);
    const video = container.querySelector('video')!;
    fireEvent.playing(video);
    fireEvent.click(screen.getByRole('button', { name: 'Pause rotation' }));
    fireEvent.ended(video);
    tick(60_000);
    expect(heading()).toBe('Title a');
  });

  it('sets the progress fill to the time the slide really stays', () => {
    const waiting = render(
      <Hero items={withClips} label="Featured" intervalMs={20_000} previewAllowed />,
    );
    expect(section(waiting.container).style.getPropertyValue('--hero-interval')).toBe('23200ms');
    waiting.unmount();
    const fixed = render(
      <Hero items={withClips} label="Featured" intervalMs={20_000} previewAllowed waitForClip={false} />,
    );
    expect(section(fixed.container).style.getPropertyValue('--hero-interval')).toBe('20000ms');
    expect(fixed.container.querySelector('.ad-hero__fill')).not.toBeNull();
  });

  it('assumes 6 seconds for a clip whose length is unknown', () => {
    const { container } = render(
      <Hero
        items={[slide('a', { previewSrc: '/a.mp4' }), slide('b')]}
        label="Featured"
        intervalMs={20_000}
        previewAllowed
      />,
    );
    expect(section(container).style.getPropertyValue('--hero-interval')).toBe('9200ms');
  });

  it('still stops after two loops when slides wait for their clips', () => {
    const { container } = render(
      <Hero items={withClips} label="Featured" intervalMs={20_000} maxLoops={1} previewAllowed />,
    );
    for (let i = 0; i < 2; i += 1) {
      tick(1200);
      const video = container.querySelector('video');
      if (video) {
        fireEvent.playing(video);
        fireEvent.ended(video);
      }
    }
    tick(60_000);
    expect(heading()).toBe('Title a');
    expect(screen.queryByRole('button', { name: /Pause rotation/ })).toBeNull();
  });
});
