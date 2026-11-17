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
