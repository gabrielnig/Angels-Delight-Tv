import { describe, expect, it } from 'vitest';
import { TapTracker, zoneFor } from './gestures';

describe('zoneFor', () => {
  it('splits the surface into thirds', () => {
    expect(zoneFor(10, 300)).toBe('left');
    expect(zoneFor(150, 300)).toBe('center');
    expect(zoneFor(290, 300)).toBe('right');
  });
});

describe('TapTracker', () => {
  it('reports a single tap', () => {
    const t = new TapTracker();
    expect(t.tap(250, 300, 0)).toEqual({ kind: 'tap' });
  });

  it('double tap on the right third seeks forward 10 with a label', () => {
    const t = new TapTracker();
    t.tap(250, 300, 0);
    expect(t.tap(250, 300, 200)).toEqual({ kind: 'seek', seconds: 10, total: 10, side: 'right' });
  });

  it('double tap on the left third seeks back 10', () => {
    const t = new TapTracker();
    t.tap(20, 300, 0);
    expect(t.tap(20, 300, 150)).toEqual({ kind: 'seek', seconds: -10, total: -10, side: 'left' });
  });

  it('accumulates repeated taps on the same side', () => {
    const t = new TapTracker();
    t.tap(250, 300, 0);
    t.tap(250, 300, 200);
    expect(t.tap(250, 300, 400)).toEqual({ kind: 'seek', seconds: 10, total: 20, side: 'right' });
    expect(t.tap(250, 300, 600)).toEqual({ kind: 'seek', seconds: 10, total: 30, side: 'right' });
  });

  it('starts a new total after the accumulate window passes', () => {
    const t = new TapTracker();
    t.tap(250, 300, 0);
    t.tap(250, 300, 200);
    t.tap(250, 300, 5000);
    expect(t.tap(250, 300, 5200)).toEqual({ kind: 'seek', seconds: 10, total: 10, side: 'right' });
  });

  it('switching sides resets the total', () => {
    const t = new TapTracker();
    t.tap(250, 300, 0);
    t.tap(250, 300, 200);
    t.tap(20, 300, 350);
    expect(t.tap(20, 300, 500)).toEqual({ kind: 'seek', seconds: -10, total: -10, side: 'left' });
  });

  it('double tap in the centre toggles play', () => {
    const t = new TapTracker();
    t.tap(150, 300, 0);
    expect(t.tap(150, 300, 200)).toEqual({ kind: 'toggle-play' });
  });

  it('two slow taps are two single taps', () => {
    const t = new TapTracker();
    t.tap(250, 300, 0);
    expect(t.tap(250, 300, 900)).toEqual({ kind: 'tap' });
  });
});
