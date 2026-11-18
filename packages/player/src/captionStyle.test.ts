import { describe, expect, it } from 'vitest';
import {
  CAPTION_BACKGROUNDS,
  CAPTION_SIZES,
  DEFAULT_CAPTION_STYLE,
  captionStyleVars,
  contrastRatio,
  normalizeCaptionStyle,
  resolveCaptionColors,
} from './captionStyle';

describe('caption styling (M11-S03)', () => {
  it('offers the four sizes and three backgrounds from the story', () => {
    expect(CAPTION_SIZES).toEqual(['small', 'medium', 'large', 'xlarge']);
    expect(CAPTION_BACKGROUNDS).toEqual(['none', 'dark', 'solid']);
  });

  it('never goes below 16 px, and each size is larger than the last', () => {
    const px = CAPTION_SIZES.map((s) =>
      Number(
        /(\d+)px/.exec(
          captionStyleVars({ ...DEFAULT_CAPTION_STYLE, size: s })['--adp-cap-size'] ?? '',
        )?.[1],
      ),
    );
    expect(px[0]).toBeGreaterThanOrEqual(16);
    expect([...px].sort((a, b) => a - b)).toEqual(px);
    expect(new Set(px).size).toBe(4);
  });

  it('maps each background to a different fill', () => {
    const fills = CAPTION_BACKGROUNDS.map(
      (background) => captionStyleVars({ ...DEFAULT_CAPTION_STYLE, background })['--adp-cap-bg'],
    );
    expect(new Set(fills).size).toBe(3);
    expect(fills[0]).toBe('transparent');
  });

  it('keeps a text shadow when there is no background so text stays readable', () => {
    const vars = captionStyleVars({ ...DEFAULT_CAPTION_STYLE, background: 'none' });
    expect(vars['--adp-cap-shadow']).not.toBe('none');
    expect(
      captionStyleVars({ ...DEFAULT_CAPTION_STYLE, background: 'solid' })['--adp-cap-shadow'],
    ).toBe('none');
  });

  it('meets 7 to 1 contrast in every high contrast combination', () => {
    for (const background of CAPTION_BACKGROUNDS) {
      const { fg, bg } = resolveCaptionColors({ size: 'medium', background, contrast: 'high' });
      expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(7);
    }
  });

  it('computes the WCAG ratio', () => {
    expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 0);
    expect(contrastRatio('#777777', '#777777')).toBeCloseTo(1, 5);
  });

  it('falls back to defaults for anything unknown', () => {
    expect(normalizeCaptionStyle({ size: 'huge', background: 5, contrast: 'x' })).toEqual(
      DEFAULT_CAPTION_STYLE,
    );
    expect(normalizeCaptionStyle(null)).toEqual(DEFAULT_CAPTION_STYLE);
    expect(normalizeCaptionStyle({ size: 'large' })).toEqual({
      ...DEFAULT_CAPTION_STYLE,
      size: 'large',
    });
  });
});
