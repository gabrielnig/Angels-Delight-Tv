import type { ThemeColorKey } from '@ad/ui';
import { bestTextColor, contrastRatio, parseHex, toHex } from './contrast';

/** Fixed dark surfaces from tokens.css that the focus ring and accent must read on. */
const DARK_SURFACES = ['#17181C', '#0E0F13'] as const;
const WHITE = '#FFFFFF';
const BLACK = '#000000';

export interface DerivedColors {
  onPrimary: string;
  onAccent: string;
  primaryHover: string;
  primaryActive: string;
  primaryTint: string;
  accentHover: string;
  accentActive: string;
  borderStrong: string;
  surfaceSunken: string;
  focusRing: string;
  focusRingDark: string;
}

/** Linear mix in sRGB. t = 0 returns `a`, t = 1 returns `b`. */
export function mix(a: string, b: string, t: number): string {
  const x = parseHex(a);
  const y = parseHex(b);
  if (!x || !y) throw new Error('mix needs two valid hex colours');
  return toHex(
    [0, 1, 2].map((i) => x[i]! + (y[i]! - x[i]!) * t) as unknown as [number, number, number],
  );
}

function minRatio(color: string, backgrounds: readonly string[]): number {
  return Math.min(...backgrounds.map((bg) => contrastRatio(color, bg) ?? 0));
}

/** Moves `color` toward `target` in 2 percent steps until it reaches `min` against every background. */
function pushUntil(
  color: string,
  target: string,
  backgrounds: readonly string[],
  min: number,
): string | null {
  for (let step = 0; step <= 50; step += 1) {
    const candidate = mix(color, target, step / 50);
    if (minRatio(candidate, backgrounds) >= min) return candidate;
  }
  return null;
}

/**
 * Computes the derived tokens of docs/DESIGN-SYSTEM.md 3.1 from the themeable colours.
 * Pure and deterministic, so the editor preview, the stored CSS and the tests agree.
 */
export function deriveColors(colors: Record<ThemeColorKey, string>): DerivedColors {
  const { bg, surface, ink, primary, accent, muted } = colors;

  const onPrimary = bestTextColor(primary, [WHITE, ink]).color;
  const onAccent = bestTextColor(accent, [ink, WHITE]).color;

  const lightPage = [bg, surface];

  // Input edges: start from a mid blend of ink and page, then darken or lighten toward the ink until 3:1.
  const start = mix(bg, ink, 0.45);
  const borderStrong =
    pushUntil(start, ink, lightPage, 3) ?? pushUntil(start, muted, lightPage, 3) ?? ink;

  let focusRing = primary;
  if (minRatio(primary, lightPage) < 3) {
    focusRing =
      pushUntil(primary, BLACK, lightPage, 3) ?? pushUntil(primary, WHITE, lightPage, 3) ?? ink;
  }

  let focusRingDark = accent;
  if (minRatio(accent, DARK_SURFACES) < 3) {
    focusRingDark = pushUntil(accent, WHITE, DARK_SURFACES, 3) ?? WHITE;
  }

  return {
    onPrimary,
    onAccent,
    primaryHover: mix(primary, BLACK, 0.14),
    primaryActive: mix(primary, BLACK, 0.28),
    primaryTint: mix(primary, WHITE, 0.9),
    accentHover: mix(accent, BLACK, 0.05),
    accentActive: mix(accent, BLACK, 0.1),
    borderStrong,
    surfaceSunken: mix(bg, BLACK, 0.04),
    focusRing,
    focusRingDark,
  };
}
