import { describe, expect, it } from 'vitest';
import { guestSeriesPrimary } from './series-resume';

const episodes = [
  { videoId: 'a', href: '/watch/a', group: 1, number: 1, durationSeconds: 600 },
  { videoId: 'b', href: '/watch/b', group: 1, number: 2, durationSeconds: 600 },
  { videoId: 'c', href: '/watch/c', group: 2, number: 1, durationSeconds: 600 },
];
const server = { text: 'Play S1 E1', href: '/watch/a' };
const entry = (p: number, f = false) => ({ p, d: 600, f, t: 1 });

describe('guestSeriesPrimary (M51-S06)', () => {
  it('keeps the server button when nothing is saved on this device', () => {
    expect(guestSeriesPrimary({ episodes }, {}, server)).toEqual(server);
  });

  it('resumes the first unfinished item that has progress, with its code', () => {
    const out = guestSeriesPrimary({ episodes, labels: { preset: 'book_chapter' } }, { a: entry(600, true), b: entry(125) }, server);
    expect(out).toEqual({ text: 'Resume B1 Ch2', href: '/watch/b', startOverHref: '/watch/b?t=0' });
  });

  it('plays the next item after a finished one, across groups', () => {
    const out = guestSeriesPrimary({ episodes }, { a: entry(600, true), b: entry(600, true) }, server);
    expect(out).toEqual({ text: 'Play S2 E1', href: '/watch/c' });
  });

  it('says Watch again from the first item when everything is finished', () => {
    const all = { a: entry(600, true), b: entry(600, true), c: entry(600, true) };
    expect(guestSeriesPrimary({ episodes }, all, server)).toEqual({ text: 'Watch again S1 E1', href: '/watch/a?t=0' });
  });

  it('treats under five seconds as not started', () => {
    const out = guestSeriesPrimary({ episodes }, { a: entry(2), b: entry(0) }, server);
    expect(out).toEqual({ text: 'Play S1 E1', href: '/watch/a' });
  });
});
