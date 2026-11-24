import { describe, expect, it } from 'vitest';
import { guestPrimary } from './resume';

const base = { watchHref: '/watch/a', durationSeconds: 600 };
const entry = (p: number, f = false) => ({ p, d: 600, f, t: 1 });

describe('guestPrimary', () => {
  it('plays from the start when nothing is saved', () => {
    expect(guestPrimary(base, null)).toEqual({ text: 'Play', href: '/watch/a' });
  });

  it('treats under five seconds as not started', () => {
    expect(guestPrimary(base, entry(4)).text).toBe('Play');
  });

  it('resumes from five seconds with the time and a start over link', () => {
    expect(guestPrimary(base, entry(134))).toEqual({
      text: 'Resume from 2:14',
      href: '/watch/a',
      startOverHref: '/watch/a?t=0',
    });
  });

  it('offers Watch again when finished', () => {
    expect(guestPrimary(base, entry(590, true))).toEqual({
      text: 'Watch again',
      href: '/watch/a?t=0',
    });
  });
});
