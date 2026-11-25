import { describe, expect, it } from 'vitest';
import { shareImageFor, shareImageVersion } from './share-image';

describe('shareImageVersion', () => {
  it('is stable, short and url safe', () => {
    expect(shareImageVersion(['a', 'b'])).toBe(shareImageVersion(['a', 'b']));
    expect(shareImageVersion(['a', 'b'])).toMatch(/^[a-z0-9]{6,10}$/);
  });
  it('changes when any input changes, and parts cannot be shifted across the join', () => {
    expect(shareImageVersion(['a', 'b'])).not.toBe(shareImageVersion(['a', 'c']));
    expect(shareImageVersion(['ab', 'c'])).not.toBe(shareImageVersion(['a', 'bc']));
  });
});

describe('shareImageFor', () => {
  it('points at the stable image route with a version that follows title, poster and publish date', () => {
    const a = shareImageFor('title', 'rivers', 'Rivers', '2026-01-01', { src: '/p1.webp' });
    expect(a).toMatchObject({ width: 1200, height: 630, type: 'image/jpeg', alt: 'Rivers' });
    expect(a.url).toMatch(/^\/og\/title\/rivers\?v=[a-z0-9]+$/);
    const b = shareImageFor('title', 'rivers', 'Rivers', '2026-01-01', { src: '/p2.webp' });
    const c = shareImageFor('title', 'rivers', 'Rivers 2', '2026-01-01', { src: '/p1.webp' });
    expect(new Set([a.url, b.url, c.url]).size).toBe(3);
  });
  it('encodes the slug and uses the poster alt when there is one', () => {
    const a = shareImageFor('series', 'a b', 'T', '', { src: '/p.webp', alt: 'A river at dawn' });
    expect(a.url).toContain('/og/series/a%20b?v=');
    expect(a.alt).toBe('A river at dawn');
  });
});
