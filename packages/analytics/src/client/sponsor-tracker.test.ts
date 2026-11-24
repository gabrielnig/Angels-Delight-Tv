import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSponsorTracker, type ObserverLike } from './sponsor-tracker';

const CREATIVE = '0198c000-0000-7000-8000-000000000001';
const IMPRESSION = '0198c000-0000-7000-8000-000000000002';

function setup(over: { hidden?: boolean; kids?: boolean } = {}) {
  let callback: ((entries: { isIntersecting: boolean; intersectionRatio: number }[]) => void) | undefined;
  let disconnected = 0;
  const observed: unknown[] = [];
  const sent: unknown[] = [];
  let hidden = over.hidden ?? false;
  const tracker = createSponsorTracker({
    send: (event) => sent.push(event),
    createObserver: (cb, options): ObserverLike => {
      callback = cb;
      expect(options.threshold).toBe(0.5);
      return { observe: (el) => observed.push(el), disconnect: () => (disconnected += 1) };
    },
    isHidden: () => hidden,
    newId: () => IMPRESSION,
    kids: over.kids ?? false,
  });
  const el = { dataset: { creative: CREATIVE, slot: 'home_banner' } } as unknown as HTMLElement;
  return {
    tracker,
    el,
    sent,
    observed,
    disconnected: () => disconnected,
    see: (ratio: number) => callback?.([{ isIntersecting: ratio >= 0.5, intersectionRatio: ratio }]),
    setHidden: (v: boolean) => (hidden = v),
  };
}

describe('sponsor tracker', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('fires after 50 percent for 1 second', () => {
    const s = setup();
    s.tracker.track(s.el);
    s.see(0.6);
    vi.advanceTimersByTime(999);
    expect(s.sent).toHaveLength(0);
    vi.advanceTimersByTime(2);
    expect(s.sent).toEqual([{ kind: 'sponsor_impression', creativeId: CREATIVE, slot: 'home_banner', impressionId: IMPRESSION }]);
  });

  it('does not fire when scrolled past quickly', () => {
    const s = setup();
    s.tracker.track(s.el);
    s.see(0.8);
    vi.advanceTimersByTime(400);
    s.see(0.1);
    vi.advanceTimersByTime(2000);
    expect(s.sent).toHaveLength(0);
  });

  it('fires once per impressionId', () => {
    const s = setup();
    s.tracker.track(s.el);
    s.see(0.9);
    vi.advanceTimersByTime(1100);
    s.see(0.1);
    s.see(0.9);
    vi.advanceTimersByTime(3000);
    expect(s.sent).toHaveLength(1);
    expect(s.disconnected()).toBe(1);
  });

  it('does not fire when the tab is hidden', () => {
    const s = setup({ hidden: true });
    s.tracker.track(s.el);
    s.see(0.9);
    vi.advanceTimersByTime(2000);
    expect(s.sent).toHaveLength(0);
  });

  it('does not fire if the tab becomes hidden during the second', () => {
    const s = setup();
    s.tracker.track(s.el);
    s.see(0.9);
    vi.advanceTimersByTime(500);
    s.setHidden(true);
    vi.advanceTimersByTime(600);
    expect(s.sent).toHaveLength(0);
  });

  it('does not load under kids mode', () => {
    const s = setup({ kids: true });
    s.tracker.track(s.el);
    expect(s.observed).toHaveLength(0);
    expect(s.sent).toHaveLength(0);
  });

  it('ignores an element without a valid creative id or slot', () => {
    const s = setup();
    s.tracker.track({ dataset: { creative: 'nope', slot: 'home_banner' } } as unknown as HTMLElement);
    s.tracker.track({ dataset: { creative: CREATIVE, slot: 'footer' } } as unknown as HTMLElement);
    expect(s.observed).toHaveLength(0);
  });
});
