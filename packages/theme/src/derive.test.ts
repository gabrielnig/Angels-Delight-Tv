import { describe, expect, it } from 'vitest';
import { contrastRatio, parseHex } from './contrast';
import { deriveColors, mix } from './derive';
import { DEFAULT_THEME, parseTheme } from './model';

const channelDistance = (a: string, b: string) => {
  const x = parseHex(a)!;
  const y = parseHex(b)!;
  return Math.max(...x.map((value, index) => Math.abs(value - y[index]!)));
};

describe('mix', () => {
  it.each([
    ['#000000', '#FFFFFF', 0, '#000000'],
    ['#000000', '#FFFFFF', 1, '#FFFFFF'],
    ['#000000', '#FFFFFF', 0.5, '#808080'],
    ['#FF0000', '#0000FF', 0.5, '#800080'],
  ])('mix(%s, %s, %s) = %s', (a, b, t, expected) => {
    expect(mix(a, b, t)).toBe(expected);
  });
});

describe('deriveColors with the default theme', () => {
  const derived = deriveColors(DEFAULT_THEME.colors);

  it('picks white on the banner blue and ink on yellow', () => {
    expect(derived.onPrimary).toBe('#FFFFFF');
    expect(derived.onAccent).toBe('#1A1C22');
  });

  it('stays close to the tokens.css defaults', () => {
    expect(channelDistance(derived.primaryHover, '#1B5F9C')).toBeLessThanOrEqual(3);
    expect(channelDistance(derived.primaryActive, '#174F83')).toBeLessThanOrEqual(6);
    expect(channelDistance(derived.primaryTint, '#E3F1FF')).toBeLessThanOrEqual(12);
    expect(channelDistance(derived.surfaceSunken, '#ECEAE3')).toBeLessThanOrEqual(12);
    expect(derived.focusRing).toBe('#1F6FB5');
    expect(derived.focusRingDark).toBe('#FFC93C');
  });

  it('keeps hover and active states readable under the same text colour', () => {
    expect(contrastRatio(derived.onPrimary, derived.primaryHover)!).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(derived.onPrimary, derived.primaryActive)!).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(derived.onAccent, derived.accentHover)!).toBeGreaterThanOrEqual(4.5);
  });

  it('gives input edges at least 3:1 on page and card', () => {
    expect(contrastRatio(derived.borderStrong, DEFAULT_THEME.colors.bg)!).toBeGreaterThanOrEqual(3);
    expect(
      contrastRatio(derived.borderStrong, DEFAULT_THEME.colors.surface)!,
    ).toBeGreaterThanOrEqual(3);
  });
});

describe('deriveColors table', () => {
  it.each([
    ['dark primary', { primary: '#0B3D6B' }, '#FFFFFF'],
    ['pale primary', { primary: '#BFE0F8' }, '#1A1C22'],
    ['green primary', { primary: '#2B7A4B' }, '#FFFFFF'],
    ['black primary', { primary: '#000000' }, '#FFFFFF'],
    ['white primary', { primary: '#FFFFFF' }, '#1A1C22'],
  ])('on-primary for %s', (_name, colors, expected) => {
    expect(deriveColors(parseTheme({ colors }).colors).onPrimary).toBe(expected);
  });

  it.each([
    ['dark accent', { accent: '#7A1E1E' }, '#FFFFFF'],
    ['pale accent', { accent: '#FFE9A8' }, '#1A1C22'],
  ])('on-accent for %s', (_name, colors, expected) => {
    expect(deriveColors(parseTheme({ colors }).colors).onAccent).toBe(expected);
  });

  it.each([
    ['light on light page', { bg: '#FFFFFF', surface: '#FFFFFF' }],
    ['mid grey page', { bg: '#C8C8C8', surface: '#D8D8D8' }],
    ['dark page', { bg: '#101216', surface: '#1B1E24', ink: '#F5F5F2', muted: '#B4B8C2' }],
  ])('border-strong passes 3:1 for %s', (_name, colors) => {
    const theme = parseTheme({ colors });
    const derived = deriveColors(theme.colors);
    expect(contrastRatio(derived.borderStrong, theme.colors.bg)!).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(derived.borderStrong, theme.colors.surface)!).toBeGreaterThanOrEqual(3);
  });

  it('darkens a focus ring when the primary is too pale for the page', () => {
    const theme = parseTheme({ colors: { primary: '#9CC9EE' } });
    const derived = deriveColors(theme.colors);
    expect(contrastRatio(derived.focusRing, theme.colors.bg)!).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(derived.focusRing, theme.colors.surface)!).toBeGreaterThanOrEqual(3);
  });

  it('lightens the dark surface focus ring when the accent is too dark', () => {
    const derived = deriveColors(parseTheme({ colors: { accent: '#3A2E00' } }).colors);
    expect(contrastRatio(derived.focusRingDark, '#17181C')!).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(derived.focusRingDark, '#0E0F13')!).toBeGreaterThanOrEqual(3);
  });

  it('is deterministic', () => {
    expect(deriveColors(DEFAULT_THEME.colors)).toEqual(deriveColors({ ...DEFAULT_THEME.colors }));
  });
});
