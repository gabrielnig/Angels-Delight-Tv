// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SponsorTrackerMount } from './SponsorTrackerMount';

const track = vi.fn();
vi.mock('../../lib/analytics/browser', () => ({ getAnalyticsClient: () => ({ track }) }));

let callbacks: ((entries: { isIntersecting: boolean; intersectionRatio: number }[]) => void)[] = [];
class FakeObserver {
  constructor(cb: (e: { isIntersecting: boolean; intersectionRatio: number }[]) => void) {
    callbacks.push(cb);
  }
  observe() {}
  disconnect() {}
}

beforeEach(() => {
  vi.useFakeTimers();
  callbacks = [];
  track.mockReset();
  vi.stubGlobal('IntersectionObserver', FakeObserver);
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
  document.body.innerHTML = '';
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const ID = '0190a000-0000-7000-8000-000000000002';
const addCard = () => {
  const el = document.createElement('aside');
  el.dataset.creative = ID;
  el.dataset.slot = 'home_banner';
  document.body.appendChild(el);
};

describe('SponsorTrackerMount', () => {
  it('records one impression after one second in view and counts it for the cap', () => {
    addCard();
    render(<SponsorTrackerMount />);
    callbacks[0]!([{ isIntersecting: true, intersectionRatio: 0.9 }]);
    vi.advanceTimersByTime(1100);
    expect(track).toHaveBeenCalledTimes(1);
    expect(track.mock.calls[0]![0]).toMatchObject({
      kind: 'sponsor_impression',
      creativeId: ID,
      slot: 'home_banner',
    });
    expect(fetch).toHaveBeenCalledWith(
      '/api/sponsors/seen',
      expect.objectContaining({ method: 'POST' }),
    );
  });
  it('does nothing when no card is on the page', () => {
    render(<SponsorTrackerMount />);
    expect(callbacks).toHaveLength(0);
  });
  it('tracks a card only once even if mounted twice', () => {
    addCard();
    render(<SponsorTrackerMount />);
    render(<SponsorTrackerMount />);
    expect(callbacks).toHaveLength(1);
  });
});
