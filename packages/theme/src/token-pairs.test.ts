import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { contrastRatio } from './contrast';
import { buildThemeVariables } from './css';
import { evaluateTheme } from './gate';
import { DEFAULT_THEME, parseTheme, type ThemeValues } from './model';

// Design review: every token pair the components rely on, computed in the default theme and in
// themes that pass the editor gate. Fixed tokens come from tokens.css, themeable and derived ones
// from buildThemeVariables, so this fails if a theme can ship an unreadable pair.
const css = readFileSync(new URL('../../ui/src/tokens.css', import.meta.url), 'utf8');
const fixed: Record<string, string> = {};
for (const match of css.matchAll(/(--color-[a-z-]+):\s*(#[0-9A-Fa-f]{6})/g)) {
  fixed[match[1]!] = match[2]!.toUpperCase();
}

function resolve(theme: ThemeValues): Record<string, string> {
  return { ...fixed, ...buildThemeVariables(theme) };
}

// [foreground, background, minimum, where it is used]
const PAIRS: [string, string, number, string][] = [
  ['ink', 'bg', 4.5, 'body text'],
  ['ink', 'surface', 4.5, 'card text'],
  ['muted', 'bg', 4.5, 'secondary text'],
  ['muted', 'surface', 4.5, 'secondary text on cards'],
  ['on-primary', 'primary', 4.5, 'primary button'],
  ['on-primary', 'primary-hover', 4.5, 'primary button hover'],
  ['on-primary', 'primary-active', 4.5, 'primary button active'],
  ['on-accent', 'accent', 4.5, 'accent button and badge'],
  ['on-accent', 'accent-hover', 4.5, 'accent hover'],
  ['on-accent', 'accent-active', 4.5, 'accent active'],
  ['ink', 'primary-tint', 4.5, 'selected rows'],
  ['ink', 'surface-sunken', 4.5, 'sunken panels'],
  ['muted', 'surface-sunken', 4.5, 'secondary text on sunken panels'],
  ['border-strong', 'bg', 3, 'input edge on page'],
  ['border-strong', 'surface', 3, 'input edge on card'],
  ['focus-ring', 'bg', 3, 'focus ring on page'],
  ['focus-ring', 'surface', 3, 'focus ring on card'],
  ['focus-ring-dark', 'sidebar-bg', 3, 'focus ring in sidebar'],
  ['focus-ring-dark', 'player-bg', 3, 'focus ring in player'],
  ['danger', 'surface', 4.5, 'error text on card'],
  ['danger', 'danger-tint', 4.5, 'error banner'],
  ['success', 'surface', 4.5, 'success text'],
  ['success', 'success-tint', 4.5, 'success badge'],
  ['warning', 'warning-tint', 4.5, 'warning banner'],
  ['info', 'info-tint', 4.5, 'info banner'],
  ['sidebar-ink', 'sidebar-bg', 4.5, 'sidebar text'],
  ['sidebar-muted', 'sidebar-bg', 4.5, 'inactive sidebar items'],
  ['sidebar-ink', 'sidebar-active', 4.5, 'active sidebar item'],
  ['sidebar-muted', 'sidebar-hover', 4.5, 'hovered sidebar item'],
  ['player-ink', 'player-bg', 4.5, 'player text'],
  ['player-muted', 'player-bg', 4.5, 'player timestamps'],
  ['player-rail', 'player-bg', 3, 'seek rail on the player (R34)'],
  ['accent', 'player-rail', 3, 'played fill on the seek rail'],
  ['accent', 'card-progress-rail', 3, 'card progress fill on its dark rail'],
  ['bar-disabled-ink', 'bar-disabled-bg', 4.5, 'disabled action on the bulk bar (R38)'],
];

const THEMES: Record<string, ThemeValues> = {
  default: DEFAULT_THEME,
  'dark ink on lemon': parseTheme({
    colors: {
      bg: '#FFF7B8',
      surface: '#FFFDE8',
      ink: '#1B1B12',
      muted: '#4D4A2E',
      border: '#E0D88A',
      primary: '#6B4E00',
      accent: '#FFE24A',
    },
    typeScale: 1.15,
  }),
  'green on off white': parseTheme({
    colors: { primary: '#1E7A46', accent: '#9BD98A', bg: '#F7FAF5' },
  }),
};

describe.each(Object.entries(THEMES))('token pairs, %s theme', (_name, theme) => {
  it('passes the editor gate (no blockers)', () => {
    expect(evaluateTheme(theme).blocked).toBe(false);
  });

  const vars = resolve(theme);
  const color = (name: string) => vars[`--color-${name}`];
  it.each(PAIRS)('%s on %s reaches %s (%s)', (fg, bg, min) => {
    const ratio = contrastRatio(color(fg)!, color(bg)!);
    expect(ratio, `${fg} on ${bg}`).not.toBeNull();
    expect(ratio!).toBeGreaterThanOrEqual(min);
  });
});

// Pairs that involve a translucent layer. Worst case: the layer sits over a pure white image.
function composite(rgb: [number, number, number], alpha: number): string {
  const channel = (c: number) => Math.round(c * alpha + 255 * (1 - alpha));
  return `#${rgb
    .map((c) => channel(c).toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()}`;
}
const SCRIM: [number, number, number] = [14, 15, 19];

describe('translucent layer pairs over a white image (R12, R35, R36)', () => {
  it('white text on the hero More info chip is at least 4.5', () => {
    expect(contrastRatio('#FFFFFF', composite(SCRIM, 0.6))!).toBeGreaterThanOrEqual(4.5);
  });

  it('white text at the lightest alpha the title zone allows (0.57) is at least 4.5', () => {
    expect(contrastRatio('#FFFFFF', composite(SCRIM, 0.57))!).toBeGreaterThanOrEqual(4.5);
  });

  it('the hero hold stop and the nav hold keep white text above 4.5', () => {
    expect(contrastRatio('#FFFFFF', composite(SCRIM, 0.85))!).toBeGreaterThanOrEqual(4.5);
    // Nav text band ends at alpha 0.595 on the 56px bar (R35).
    expect(contrastRatio('#FFFFFF', composite(SCRIM, 0.595))!).toBeGreaterThanOrEqual(4.5);
  });

  it('the accent focus ring on the hold stop (0.85) is at least 3', () => {
    expect(
      contrastRatio(fixed['--color-focus-ring-dark']!, composite(SCRIM, 0.85))!,
    ).toBeGreaterThanOrEqual(3);
  });

  it('only large text may sit on the 0.45 mid stop', () => {
    const ratio = contrastRatio('#FFFFFF', composite(SCRIM, 0.45))!;
    expect(ratio).toBeGreaterThanOrEqual(3);
    expect(ratio).toBeLessThan(4.5);
  });
});
