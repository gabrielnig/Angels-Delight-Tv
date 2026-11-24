import { describe, expect, it } from 'vitest';
import { contrastRatio } from '@ad/theme';
import {
  OG_HEIGHT,
  OG_WIDTH,
  SCRIM_RGB,
  SCRIM_STOPS,
  TITLE_ZONE,
  chooseOgImage,
  pickPosterUrl,
  scrimAlphaAt,
  scrimCss,
  truncateTitle,
} from './og-image';

const hex = ([r, g, b]: number[]) =>
  `#${[r, g, b].map((v) => Math.round(v!).toString(16).padStart(2, '0')).join('')}`;

describe('share image geometry (M45-S03)', () => {
  it('is 1200 by 630', () => {
    expect([OG_WIDTH, OG_HEIGHT]).toEqual([1200, 630]);
  });
});

describe('title text', () => {
  it('keeps a short title as it is', () => {
    expect(truncateTitle('Rivers of Nigeria')).toBe('Rivers of Nigeria');
  });
  it('cuts at two lines worth of characters on a word boundary with an ellipsis', () => {
    const long =
      'Understanding household budgeting for families who earn irregular income across the year';
    const out = truncateTitle(long);
    expect(out.length).toBeLessThanOrEqual(80);
    expect(out.endsWith('…')).toBe(true);
    expect(long.startsWith(out.slice(0, -1).trimEnd())).toBe(true);
    expect(out.slice(0, -1)).not.toMatch(/\s$/);
  });
  it('collapses whitespace', () => {
    expect(truncateTitle('  A   B \n C ')).toBe('A B C');
  });
});

describe('scrim', () => {
  it('uses the four reviewed stops', () => {
    expect(SCRIM_STOPS).toEqual([
      { at: 0, alpha: 0 },
      { at: 38, alpha: 0.62 },
      { at: 58, alpha: 0.85 },
      { at: 100, alpha: 0.85 },
    ]);
  });
  it('interpolates between stops and holds the last value', () => {
    expect(scrimAlphaAt(0)).toBe(0);
    expect(scrimAlphaAt(19)).toBeCloseTo(0.31, 2);
    expect(scrimAlphaAt(58)).toBe(0.85);
    expect(scrimAlphaAt(100)).toBe(0.85);
  });
  it('writes a css gradient from the stops', () => {
    const css = scrimCss();
    expect(css).toContain('linear-gradient(to bottom');
    expect(css).toContain('0%');
    expect(css).toContain('58%');
  });
  it('keeps white text at 4.5 to 1 over a pure white poster everywhere in the title zone', () => {
    for (let pct = TITLE_ZONE.from; pct <= TITLE_ZONE.to; pct += 1) {
      const a = scrimAlphaAt(pct);
      const blended = SCRIM_RGB.map((c) => c * a + 255 * (1 - a));
      expect(contrastRatio('#ffffff', hex(blended)) ?? 0, `at ${pct}%`).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe('poster choice', () => {
  it('prefers a jpeg at least 1200 wide, otherwise the widest', () => {
    const thumb = {
      src: 'https://m.test/p-320.webp',
      srcSet:
        'https://m.test/p-320.webp 320w, https://m.test/p-1280.webp 1280w, https://m.test/p-960.webp 960w',
      fallbackSrc: 'https://m.test/p-320.jpg',
      fallbackSrcSet: 'https://m.test/p-320.jpg 320w, https://m.test/p-1280.jpg 1280w',
    };
    expect(pickPosterUrl(thumb)).toBe('https://m.test/p-1280.jpg');
    expect(
      pickPosterUrl({ src: 'https://m.test/a.webp', srcSet: 'https://m.test/a.webp 640w' }),
    ).toBe('https://m.test/a.webp');
    expect(pickPosterUrl(undefined)).toBeNull();
  });
});

describe('which image a title shares', () => {
  it('uses the poster when there is one, then the site default, then the placeholder', () => {
    expect(
      chooseOgImage({ posterUrl: 'https://m.test/p.jpg', siteDefaultUrl: 'https://m.test/d.png' }),
    ).toEqual({ kind: 'generated' });
    expect(chooseOgImage({ posterUrl: null, siteDefaultUrl: 'https://m.test/d.png' })).toEqual({
      kind: 'default',
      url: 'https://m.test/d.png',
    });
    expect(chooseOgImage({ posterUrl: null, siteDefaultUrl: null })).toEqual({
      kind: 'default',
      url: '/brand-icons/placeholder-og.png',
    });
  });
});
