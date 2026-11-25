// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HomeHero } from './HomeHero';

const items = ['One', 'Two'].map((title) => ({
  id: title,
  title,
  description: `About ${title}`,
  meta: '5 min',
  playHref: `/watch/${title}`,
  infoHref: `/title/${title}`,
}));

beforeEach(() => {
  vi.useFakeTimers();
  window.matchMedia = ((q: string) => ({
    matches: false,
    media: q,
    addEventListener() {},
    removeEventListener() {},
  })) as never;
});
afterEach(() => {
  vi.useRealTimers();
  localStorage.clear();
});

describe('HomeHero', () => {
  it('rotates every 20 seconds by default', () => {
    render(<HomeHero items={items} label="Featured" profileId="p1" />);
    expect(screen.getByRole('heading', { name: 'One' })).toBeInTheDocument();
    act(() => void vi.advanceTimersByTime(19999));
    expect(screen.getByRole('heading', { name: 'One' })).toBeInTheDocument();
    act(() => void vi.advanceTimersByTime(1));
    expect(screen.getByRole('heading', { name: 'Two' })).toBeInTheDocument();
  });

  it('does not rotate when Data saver is on for the profile', () => {
    localStorage.setItem('ad.datasaver.p1', 'on');
    render(<HomeHero items={items} label="Featured" profileId="p1" />);
    act(() => void vi.advanceTimersByTime(20000));
    expect(screen.getByRole('heading', { name: 'One' })).toBeInTheDocument();
  });

  it('uses the interval from the site setting', () => {
    render(<HomeHero items={items} label="Featured" profileId="p1" intervalSeconds={5} />);
    act(() => void vi.advanceTimersByTime(5000));
    expect(screen.getByRole('heading', { name: 'Two' })).toBeInTheDocument();
  });

  it('does not rotate when the site setting is off', () => {
    render(<HomeHero items={items} label="Featured" profileId="p1" rotate={false} />);
    act(() => void vi.advanceTimersByTime(30000));
    expect(screen.getByRole('heading', { name: 'One' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /rotation/ })).toBeNull();
  });

  describe('preview clip', () => {
    const clips = items.map((item) => ({ ...item, previewSrc: `/${item.id}.mp4` }));
    const fastNav = (over: object = {}) =>
      Object.defineProperty(navigator, 'connection', {
        configurable: true,
        value: { effectiveType: '4g', downlink: 10, saveData: false, ...over },
      });
    afterEach(() => Reflect.deleteProperty(navigator, 'connection'));

    it('mounts a clip on a fast connection', () => {
      fastNav();
      const { container } = render(<HomeHero items={clips} label="Featured" profileId="p1" previews />);
      expect(container.querySelectorAll('video').length).toBe(1);
    });
    it('mounts none when the site switch is off, on 3g or under Data saver', () => {
      fastNav();
      const off = render(<HomeHero items={clips} label="Featured" profileId="p1" previews={false} />);
      expect(off.container.querySelector('video')).toBeNull();
      off.unmount();
      fastNav({ effectiveType: '3g' });
      const slow = render(<HomeHero items={clips} label="Featured" profileId="p1" previews />);
      expect(slow.container.querySelector('video')).toBeNull();
      slow.unmount();
      fastNav();
      localStorage.setItem('ad.datasaver.p1', 'on');
      const saver = render(<HomeHero items={clips} label="Featured" profileId="p1" previews />);
      expect(saver.container.querySelector('video')).toBeNull();
    });
    it('treats an unknown connection as off unless allowed', () => {
      const unknown = render(<HomeHero items={clips} label="Featured" profileId="p1" previews />);
      expect(unknown.container.querySelector('video')).toBeNull();
      unknown.unmount();
      const allowed = render(
        <HomeHero items={clips} label="Featured" profileId="p1" previews allowUnknownConnection />,
      );
      expect(allowed.container.querySelectorAll('video').length).toBe(1);
    });
    it('plays on a 2.5 Mbps link with the default floor and not with a floor of 4', () => {
      fastNav({ downlink: 2.5 });
      const ok = render(<HomeHero items={clips} label="Featured" profileId="p1" previews />);
      expect(ok.container.querySelectorAll('video').length).toBe(1);
      ok.unmount();
      const strict = render(
        <HomeHero items={clips} label="Featured" profileId="p1" previews minDownlinkMbps={4} />,
      );
      expect(strict.container.querySelector('video')).toBeNull();
    });
    it('lets the slide wait for its clip, or not, by the site setting', () => {
      fastNav();
      const sized = items.map((item) => ({ ...item, previewSrc: `/${item.id}.mp4`, previewMs: 20_000 }));
      const waits = render(<HomeHero items={sized} label="Featured" profileId="p1" previews />);
      act(() => void vi.advanceTimersByTime(20_000));
      expect(screen.getByRole('heading', { name: 'One' })).toBeInTheDocument();
      waits.unmount();
      render(<HomeHero items={sized} label="Featured" profileId="p1" previews waitForClip={false} />);
      act(() => void vi.advanceTimersByTime(20_000));
      expect(screen.getByRole('heading', { name: 'Two' })).toBeInTheDocument();
    });
    it('stops the clip when the connection turns slow', () => {
      const listeners: Array<() => void> = [];
      const conn = { effectiveType: '4g', downlink: 10, saveData: false, addEventListener: (_: string, f: () => void) => listeners.push(f), removeEventListener() {} };
      Object.defineProperty(navigator, 'connection', { configurable: true, value: conn });
      const { container } = render(<HomeHero items={clips} label="Featured" profileId="p1" previews />);
      expect(container.querySelectorAll('video').length).toBe(1);
      conn.effectiveType = '2g';
      act(() => listeners.forEach((f) => f()));
      expect(container.querySelector('video')).toBeNull();
    });
  });
});
