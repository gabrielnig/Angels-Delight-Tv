import { describe, expect, it } from 'vitest';
import {
  CAPTION_BACKGROUNDS,
  CAPTION_COLORS,
  captionColorAllowed,
  CAPTION_EDGES,
  CAPTION_SIZES,
  DEFAULT_CAPTION_STYLE,
  captionStyleVars,
  contrastRatio,
  effectiveEdge,
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

  it('keeps an edge when there is no background so text stays readable', () => {
    const clear = { ...DEFAULT_CAPTION_STYLE, background: 'none' as const, edge: 'none' as const };
    expect(captionStyleVars(clear)['--adp-cue-edge']).not.toBe('none');
  });

  it('meets 7 to 1 contrast in every high contrast combination', () => {
    for (const background of CAPTION_BACKGROUNDS) {
      const { fg, bg } = resolveCaptionColors({
        ...DEFAULT_CAPTION_STYLE,
        background,
        contrast: 'high',
      });
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

  it('accepts edge none, shadow and outline', () => {
    expect(CAPTION_EDGES).toEqual(['none', 'shadow', 'outline']);
    for (const edge of CAPTION_EDGES) {
      expect(normalizeCaptionStyle({ edge }).edge).toBe(edge);
    }
    expect(normalizeCaptionStyle({ edge: 'glow' }).edge).toBe('shadow');
  });

  it('defaults a missing edge to shadow', () => {
    expect(normalizeCaptionStyle({ size: 'large' }).edge).toBe('shadow');
    expect(DEFAULT_CAPTION_STYLE.edge).toBe('shadow');
  });

  it('emits a different edge value for shadow and outline, and none on a backed caption', () => {
    const edgeOf = (edge: 'none' | 'shadow' | 'outline', background: 'none' | 'dark' | 'solid') =>
      captionStyleVars({ ...DEFAULT_CAPTION_STYLE, edge, background })['--adp-cue-edge'];
    expect(edgeOf('shadow', 'dark')).not.toBe(edgeOf('outline', 'dark'));
    expect(edgeOf('none', 'dark')).toBe('none');
    expect(edgeOf('none', 'solid')).toBe('none');
  });

  it('switches Edge None to Shadow on a clear background (L4-D19)', () => {
    expect(effectiveEdge({ ...DEFAULT_CAPTION_STYLE, background: 'none', edge: 'none' })).toBe(
      'shadow',
    );
    expect(effectiveEdge({ ...DEFAULT_CAPTION_STYLE, background: 'none', edge: 'outline' })).toBe(
      'outline',
    );
    expect(effectiveEdge({ ...DEFAULT_CAPTION_STYLE, background: 'dark', edge: 'none' })).toBe(
      'none',
    );
  });
});

describe('caption colour (L10 M49-S11)', () => {
  it('offers white and yellow and defaults to white', () => {
    expect(CAPTION_COLORS).toEqual(['white', 'yellow']);
    expect(DEFAULT_CAPTION_STYLE.color).toBe('white');
    expect(normalizeCaptionStyle({ size: 'large' }).color).toBe('white');
  });

  it('normalises an unknown colour to white', () => {
    expect(normalizeCaptionStyle({ color: 'pink' }).color).toBe('white');
    expect(normalizeCaptionStyle({ color: 'yellow' }).color).toBe('yellow');
  });

  it('draws yellow text on a backed caption and keeps white as the default', () => {
    const yellow = { ...DEFAULT_CAPTION_STYLE, color: 'yellow' as const };
    expect(captionStyleVars(yellow)['--adp-cap-fg']).toBe('#ffe600');
    expect(captionStyleVars(DEFAULT_CAPTION_STYLE)['--adp-cap-fg']).toBe('#ffffff');
  });

  it('meets 4.5 to 1 for yellow on every background fill it is allowed with', () => {
    for (const background of ['dark', 'solid'] as const) {
      const { fg, bg } = resolveCaptionColors({
        ...DEFAULT_CAPTION_STYLE,
        color: 'yellow',
        background,
      });
      expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('refuses yellow with no background when contrast is standard', () => {
    const style = {
      ...DEFAULT_CAPTION_STYLE,
      color: 'yellow' as const,
      background: 'none' as const,
    };
    expect(captionColorAllowed(style)).toBe(false);
    expect(captionColorAllowed({ ...style, background: 'dark' })).toBe(true);
    expect(captionColorAllowed({ ...style, contrast: 'high' })).toBe(true);
    expect(captionColorAllowed({ ...style, color: 'white' })).toBe(true);
    // The player falls back to white rather than draw a failing combination.
    expect(normalizeCaptionStyle(style).color).toBe('white');
  });
});
