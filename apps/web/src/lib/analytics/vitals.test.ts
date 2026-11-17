import { parseBatch } from '@ad/analytics';
import { describe, expect, it } from 'vitest';
import { routeBucket, vitalToEvent } from './vitals';

describe('routeBucket', () => {
  it('keeps only the first path segment so no slug, id or query leaks', () => {
    expect(routeBucket('/')).toBe('/');
    expect(routeBucket('/watch/how-plants-make-food?t=30')).toBe('/watch');
    expect(routeBucket('/admin/videos/123')).toBe('/admin');
    expect(routeBucket('/Browse/Science')).toBe('/browse');
  });
  it('falls back to root for anything odd', () => {
    expect(routeBucket('')).toBe('/');
    expect(routeBucket('//')).toBe('/');
  });
});

describe('vitalToEvent', () => {
  it('maps a supported metric to a valid analytics event', () => {
    const event = vitalToEvent({ name: 'LCP', value: 2345.6 }, '/watch/x');
    expect(event).toEqual({ kind: 'vitals', name: 'LCP', value: 2345.6, route: '/watch' });
    expect(parseBatch({ v: 1, events: [event] })).toMatchObject({ ok: true, rejected: 0 });
  });
  it('ignores metrics we do not track', () => {
    expect(vitalToEvent({ name: 'Next.js-hydration', value: 5 }, '/')).toBeNull();
  });
  it('clamps absurd values', () => {
    expect(vitalToEvent({ name: 'TTFB', value: -4 }, '/')?.value).toBe(0);
    expect(vitalToEvent({ name: 'INP', value: 9e9 }, '/')?.value).toBe(600_000);
  });
});
