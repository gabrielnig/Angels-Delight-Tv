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
  it('rotates every 10 seconds', () => {
    render(<HomeHero items={items} label="Featured" profileId="p1" />);
    expect(screen.getByRole('heading', { name: 'One' })).toBeInTheDocument();
    act(() => void vi.advanceTimersByTime(10000));
    expect(screen.getByRole('heading', { name: 'Two' })).toBeInTheDocument();
  });

  it('does not rotate when Data saver is on for the profile', () => {
    localStorage.setItem('ad.datasaver.p1', 'on');
    render(<HomeHero items={items} label="Featured" profileId="p1" />);
    act(() => void vi.advanceTimersByTime(20000));
    expect(screen.getByRole('heading', { name: 'One' })).toBeInTheDocument();
  });
});
