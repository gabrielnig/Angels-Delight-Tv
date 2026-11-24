/** Caption size, background and contrast per profile (M11-S03). Pure, so the settings preview and the player share it. */

export const CAPTION_SIZES = ['small', 'medium', 'large', 'xlarge'] as const;
export const CAPTION_BACKGROUNDS = ['none', 'dark', 'solid'] as const;
export const CAPTION_EDGES = ['none', 'shadow', 'outline'] as const;
export const CAPTION_CONTRASTS = ['standard', 'high'] as const;

export type CaptionSize = (typeof CAPTION_SIZES)[number];
export type CaptionBackground = (typeof CAPTION_BACKGROUNDS)[number];
export type CaptionEdge = (typeof CAPTION_EDGES)[number];
export type CaptionContrast = (typeof CAPTION_CONTRASTS)[number];

export interface CaptionStyle {
  size: CaptionSize;
  background: CaptionBackground;
  contrast: CaptionContrast;
  edge: CaptionEdge;
}

/** White on a semi opaque dark background, the M11-S06 default. */
export const DEFAULT_CAPTION_STYLE: CaptionStyle = {
  size: 'medium',
  background: 'dark',
  contrast: 'standard',
  edge: 'shadow',
};

const SIZE_PX: Record<CaptionSize, number> = { small: 16, medium: 20, large: 26, xlarge: 34 };

export function normalizeCaptionStyle(input: unknown): CaptionStyle {
  const v = (typeof input === 'object' && input !== null ? input : {}) as Record<string, unknown>;
  const pick = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T =>
    allowed.includes(value as T) ? (value as T) : fallback;
  return {
    size: pick(v.size, CAPTION_SIZES, DEFAULT_CAPTION_STYLE.size),
    background: pick(v.background, CAPTION_BACKGROUNDS, DEFAULT_CAPTION_STYLE.background),
    contrast: pick(v.contrast, CAPTION_CONTRASTS, DEFAULT_CAPTION_STYLE.contrast),
    edge: pick(v.edge, CAPTION_EDGES, DEFAULT_CAPTION_STYLE.edge),
  };
}

function luminance(hex: string): number {
  const n = Number.parseInt(hex.replace('#', ''), 16);
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return (
    0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255)
  );
}

/** WCAG contrast ratio between two opaque #rrggbb colours. */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Text and fill colours. High contrast is yellow or white on pure black, 19.6 to 1 and 21 to 1. With no
 * background the shadow carries the contrast, so the high contrast check uses black as the worst case frame.
 */
export function resolveCaptionColors(style: CaptionStyle): {
  fg: string;
  bg: string;
  fill: string;
} {
  if (style.contrast === 'high') {
    return {
      fg: style.background === 'solid' ? '#ffffff' : '#ffff00',
      bg: '#000000',
      fill: style.background === 'none' ? 'transparent' : '#000000',
    };
  }
  const fill =
    style.background === 'none'
      ? 'transparent'
      : style.background === 'solid'
        ? '#000000'
        : 'rgba(0, 0, 0, 0.72)';
  return { fg: '#ffffff', bg: '#000000', fill };
}

const EDGE_VALUE: Record<CaptionEdge, string> = {
  none: 'none',
  shadow: '0 0 4px #000000, 0 0 2px #000000, 1px 1px 2px #000000',
  outline:
    '-1px -1px 0 #000000, 1px -1px 0 #000000, -1px 1px 0 #000000, 1px 1px 0 #000000, 0 0 3px #000000',
};

/**
 * The edge that is drawn. With a clear background an edge of None would leave white text on whatever the frame
 * shows, so it becomes Shadow (L4-D19). The saved choice is not changed.
 */
export function effectiveEdge(style: CaptionStyle): CaptionEdge {
  return style.background === 'none' && style.edge === 'none' ? 'shadow' : style.edge;
}

/** CSS custom properties the player stylesheet reads in `::cue`. */
export function captionStyleVars(style: CaptionStyle): Record<string, string> {
  const { fg, fill } = resolveCaptionColors(style);
  return {
    '--adp-cap-size': `${SIZE_PX[style.size]}px`,
    '--adp-cap-fg': fg,
    '--adp-cap-bg': fill,
    '--adp-cue-edge': EDGE_VALUE[effectiveEdge(style)],
  };
}
