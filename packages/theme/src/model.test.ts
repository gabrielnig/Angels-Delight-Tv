import { describe, expect, it } from 'vitest';
import { ThemeValidationError } from '@ad/ui';
import {
  DEFAULT_THEME,
  FONT_OPTIONS,
  RADIUS_OPTIONS,
  TYPE_SCALE_OPTIONS,
  parseTheme,
  themesEqual,
} from './model';

describe('defaults', () => {
  it('match docs/MODULES.md and tokens.css', () => {
    expect(DEFAULT_THEME.colors).toEqual({
      bg: '#F5F5F2',
      surface: '#FFFFFF',
      ink: '#1A1C22',
      muted: '#5B606B',
      border: '#DEDDD6',
      primary: '#1F6FB5',
      accent: '#FFC93C',
    });
    expect(DEFAULT_THEME.fontKey).toBe('space-grotesk');
    expect(DEFAULT_THEME.typeScale).toBe(1);
  });

  it('exposes the curated fonts of D-007 and nothing else', () => {
    expect(FONT_OPTIONS.map((font) => font.label)).toEqual([
      'Space Grotesk',
      'Inter',
      'DM Sans',
      'Poppins',
      'Nunito',
      'Lora',
    ]);
    expect(FONT_OPTIONS.every((font) => font.description.length > 0)).toBe(true);
  });

  it('offers type scales from 0.9 to 1.15 in 0.05 steps', () => {
    expect(TYPE_SCALE_OPTIONS.map((option) => option.value)).toEqual([
      0.9, 0.95, 1, 1.05, 1.1, 1.15,
    ]);
    expect(RADIUS_OPTIONS.map((option) => option.value)[0]).toBe(0);
  });
});

describe('parseTheme', () => {
  it('fills missing fields from the defaults', () => {
    expect(parseTheme({})).toEqual(DEFAULT_THEME);
    expect(parseTheme({ colors: { primary: '#2B7A4B' } }).colors.bg).toBe('#F5F5F2');
  });

  it('normalises hex input', () => {
    const theme = parseTheme({ colors: { primary: '2b7a4b', accent: '#fc3' } });
    expect(theme.colors.primary).toBe('#2B7A4B');
    expect(theme.colors.accent).toBe('#FFCC33');
  });

  it.each([
    ['invalid hex', { colors: { primary: '#1F6FZ5' } }, 'colors.primary'],
    ['unknown colour key', { colors: { sidebar: '#000000' } }, 'colors.sidebar'],
    ['unknown top level key', { css: 'body{}' }, 'css'],
    ['font outside the list', { fontKey: 'comic-sans' }, 'fontKey'],
    ['type scale too small', { typeScale: 0.5 }, 'typeScale'],
    ['type scale too large', { typeScale: 1.4 }, 'typeScale'],
    ['type scale off step', { typeScale: 1.02 }, 'typeScale'],
    ['radius too large', { radiusScale: 3 }, 'radiusScale'],
    ['radius negative', { radiusScale: -1 }, 'radiusScale'],
    ['density unknown', { density: 'huge' }, 'density'],
    ['not an object', 'red', ''],
    ['array', [], ''],
    ['null', null, ''],
  ])('rejects %s', (_name, input, field) => {
    try {
      parseTheme(input);
      throw new Error('expected a validation error');
    } catch (error) {
      expect(error).toBeInstanceOf(ThemeValidationError);
      expect((error as ThemeValidationError).issues.map((issue) => issue.field)).toContain(field);
    }
  });

  it('reports every problem at once', () => {
    try {
      parseTheme({ colors: { bg: 'x', ink: 'y' }, typeScale: 9 });
    } catch (error) {
      expect((error as ThemeValidationError).issues).toHaveLength(3);
    }
  });

  it('rejects values that smuggle css', () => {
    expect(() => parseTheme({ colors: { bg: '#FFFFFF; } body { display:none' } })).toThrow(
      ThemeValidationError,
    );
  });
});

describe('themesEqual', () => {
  it('compares by value', () => {
    expect(themesEqual(DEFAULT_THEME, parseTheme({}))).toBe(true);
    expect(themesEqual(DEFAULT_THEME, parseTheme({ density: 'compact' }))).toBe(false);
  });
});
