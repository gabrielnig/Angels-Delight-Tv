import { describe, expect, it } from 'vitest';
import { DEFAULT_THEME, parseTheme, themesEqual } from './model';
import { evaluateTheme } from './gate';
import { THEME_PRESETS, findPreset } from './presets';

describe('theme presets', () => {
  it('ships the six ready presets, default first', () => {
    expect(THEME_PRESETS.map((p) => p.key)).toEqual([
      'default',
      'sky-blue',
      'turquoise',
      'lemon-green',
      'sunny-yellow',
      'lavender',
    ]);
    expect(themesEqual(THEME_PRESETS[0]!.theme, DEFAULT_THEME)).toBe(true);
  });

  it.each(THEME_PRESETS.map((p) => [p.key, p] as const))('%s passes the contrast gate cleanly', (_k, preset) => {
    const gate = evaluateTheme(preset.theme);
    expect(gate.blockers.map((c) => c.message)).toEqual([]);
    expect(gate.warnings.map((c) => c.message)).toEqual([]);
    expect(() => parseTheme(preset.theme)).not.toThrow();
  });

  it('has distinct primaries and plain labels', () => {
    expect(new Set(THEME_PRESETS.map((p) => p.theme.colors.primary)).size).toBe(6);
    for (const p of THEME_PRESETS) expect(p.label).toMatch(/^[A-Z][A-Za-z ]+$/);
  });

  it('finds a preset by key', () => {
    expect(findPreset('lavender')?.label).toBe('Lavender');
    expect(findPreset('nope')).toBeUndefined();
  });
});
