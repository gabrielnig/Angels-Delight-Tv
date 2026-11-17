/**
 * WCAG 2.2 contrast maths. Pure functions, no dependencies.
 * https://www.w3.org/TR/WCAG22/#dfn-relative-luminance
 */

export type Rgb = readonly [number, number, number];

const HEX_3 = /^#?([0-9a-f])([0-9a-f])([0-9a-f])$/i;
const HEX_6 = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i;

/** Accepts 3 or 6 digits with or without the hash (M18-S01 edge case). */
export function parseHex(input: unknown): Rgb | null {
  if (typeof input !== 'string') return null;
  const text = input.trim();
  const short = HEX_3.exec(text);
  if (short) {
    return [short[1]!, short[2]!, short[3]!].map((digit) =>
      parseInt(digit + digit, 16),
    ) as unknown as Rgb;
  }
  const long = HEX_6.exec(text);
  if (long) return [parseInt(long[1]!, 16), parseInt(long[2]!, 16), parseInt(long[3]!, 16)];
  return null;
}

export function toHex(rgb: Rgb): string {
  return (
    '#' +
    rgb
      .map((channel) =>
        Math.min(255, Math.max(0, Math.round(channel)))
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')
      .toUpperCase()
  );
}

/** Canonical `#RRGGBB` upper case, or null when the input is not a hex colour. */
export function normalizeHex(input: unknown): string | null {
  const rgb = parseHex(input);
  return rgb ? toHex(rgb) : null;
}

function linear(channel: number): number {
  const s = channel / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

export function relativeLuminance(rgb: Rgb): number {
  return 0.2126 * linear(rgb[0]) + 0.7152 * linear(rgb[1]) + 0.0722 * linear(rgb[2]);
}

/** Ratio between 1 and 21, or null when either colour is not valid hex. */
export function contrastRatio(foreground: string, background: string): number | null {
  const fg = parseHex(foreground);
  const bg = parseHex(background);
  if (!fg || !bg) return null;
  const a = relativeLuminance(fg);
  const b = relativeLuminance(bg);
  const [light, dark] = a >= b ? [a, b] : [b, a];
  return (light + 0.05) / (dark + 0.05);
}

/** Two decimals, truncated so 4.4999 never displays as a passing 4.50. */
export function formatRatio(ratio: number | null): string {
  if (ratio === null) return 'Not checked';
  return `${(Math.floor(ratio * 100 + 1e-9) / 100).toFixed(2)}:1`;
}

export const AA_TEXT = 4.5;
export const AA_LARGE_OR_UI = 3;

export interface TextChoice {
  color: string;
  ratio: number;
  passes: boolean;
}

/** The candidate with the highest ratio against `background`. First candidate wins ties. */
export function bestTextColor(background: string, candidates: readonly string[]): TextChoice {
  let best: TextChoice | null = null;
  for (const candidate of candidates) {
    const ratio = contrastRatio(candidate, background);
    if (ratio === null) continue;
    if (best === null || ratio > best.ratio) {
      best = { color: normalizeHex(candidate)!, ratio, passes: ratio >= AA_TEXT };
    }
  }
  if (best === null) throw new Error('bestTextColor needs a valid background and candidate');
  return best;
}
