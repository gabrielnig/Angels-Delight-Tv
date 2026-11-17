import { describe, expect, it } from 'vitest';
import { evaluateTheme } from './gate';
import { DEFAULT_THEME, parseTheme } from './model';

const withColors = (colors: Record<string, string>) => parseTheme({ colors });

describe('evaluateTheme default theme', () => {
  const result = evaluateTheme(DEFAULT_THEME);

  it('passes with no blockers or warnings', () => {
    expect(result.blocked).toBe(false);
    expect(result.blockers).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.requiresAcknowledgement).toBe(false);
  });

  it('reports the ratios shown in the editor', () => {
    const byId = Object.fromEntries(result.checks.map((check) => [check.id, check]));
    expect(byId['ink-on-bg']!.ratio).toBeCloseTo(15.59, 1);
    expect(byId['ink-on-surface']!.ratio).toBeCloseTo(17.03, 1);
    expect(byId['muted-on-bg']!.ratio).toBeCloseTo(5.77, 1);
    expect(byId['on-primary']!.ratio).toBeCloseTo(5.25, 1);
    expect(byId['on-accent']!.ratio).toBeCloseTo(11.09, 1);
    expect(byId['primary-on-bg']!.ratio).toBeCloseTo(4.81, 1);
    expect(result.checks.every((check) => check.level === 'pass')).toBe(true);
  });
});

describe('save gate levels', () => {
  it.each([
    // [name, colours, check id, expected level]
    ['ink too close to page', { ink: '#8A8D94' }, 'ink-on-bg', 'block'],
    [
      'ink just under 4.5',
      { ink: '#767676', bg: '#F5F5F2', surface: '#F5F5F2' },
      'ink-on-bg',
      'block',
    ],
    [
      'ink exactly passes with white',
      { ink: '#767676', bg: '#FFFFFF', surface: '#FFFFFF' },
      'ink-on-bg',
      'pass',
    ],
    ['muted too faint on card', { muted: '#A0A0A0' }, 'muted-on-surface', 'block'],
    ['pale primary flips button text to ink', { primary: '#7FB8E6' }, 'on-primary', 'pass'],
    [
      'mid grey primary, neither text colour reaches 4.5',
      { primary: '#808080' },
      'on-primary',
      'warn',
    ],
    ['near white primary, under 2', { primary: '#C9E3F7' }, 'on-primary', 'pass'],
    ['primary link on page 3 to 4.5', { primary: '#4A8FD0' }, 'primary-on-bg', 'warn'],
    ['primary as link below 3', { primary: '#9CC9EE' }, 'primary-on-bg', 'warn'],
    ['mid accent, neither text colour reaches 4.5', { accent: '#808080' }, 'on-accent', 'warn'],
  ])('%s', (_name, colors, id, level) => {
    const result = evaluateTheme(withColors(colors));
    expect(result.checks.find((check) => check.id === id)!.level).toBe(level);
  });

  it('blocks when ink on bg fails and does not need an acknowledgement', () => {
    const result = evaluateTheme(withColors({ ink: '#8A8D94' }));
    expect(result.blocked).toBe(true);
    expect(result.blockers.map((check) => check.id)).toContain('ink-on-bg');
  });

  it('blocks button text below 2:1 even after auto-choosing white or ink', () => {
    const result = evaluateTheme(withColors({ primary: '#F5F5F5', ink: '#EEEEEE' }));
    expect(result.blockers.map((check) => check.id)).toContain('on-primary');
    expect(result.checks.find((check) => check.id === 'on-primary')!.ratio).toBeLessThan(2);
  });

  it('warns but does not block when the pair sits between 2 and 4.5', () => {
    const result = evaluateTheme(withColors({ primary: '#808080' }));
    expect(result.blocked).toBe(false);
    expect(result.requiresAcknowledgement).toBe(true);
    expect(result.warnings.map((check) => check.id)).toContain('on-primary');
  });

  it('on-primary flips to ink when the primary is pale, so a pale blue passes', () => {
    const result = evaluateTheme(withColors({ primary: '#C9E3F7' }));
    expect(result.derived.onPrimary).toBe('#1A1C22');
    expect(result.blocked).toBe(false);
  });

  it('warning ids stay stable and unique', () => {
    const ids = evaluateTheme(DEFAULT_THEME).checks.map((check) => check.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('suggestions', () => {
  it('suggests a darker ink that passes 4.5 on both page colours', () => {
    const result = evaluateTheme(withColors({ ink: '#8A8D94' }));
    const check = result.checks.find((item) => item.id === 'ink-on-bg')!;
    expect(check.suggestion?.field).toBe('ink');
    const fixed = evaluateTheme(withColors({ ink: check.suggestion!.value }));
    expect(fixed.blocked).toBe(false);
  });

  it('suggests a darker primary for white button text', () => {
    const check = evaluateTheme(withColors({ primary: '#808080' })).checks.find(
      (item) => item.id === 'on-primary',
    )!;
    expect(check.suggestion?.field).toBe('primary');
    const fixed = evaluateTheme(withColors({ primary: check.suggestion!.value }));
    expect(fixed.checks.find((item) => item.id === 'on-primary')!.level).toBe('pass');
  });

  it('gives no suggestion for a passing pair', () => {
    for (const check of evaluateTheme(DEFAULT_THEME).checks)
      expect(check.suggestion).toBeUndefined();
  });
});

describe('fields to badge mapping', () => {
  it('maps each editor field to its check', () => {
    const result = evaluateTheme(DEFAULT_THEME);
    expect(result.byField.ink!.ratio).toBeCloseTo(15.59, 1);
    expect(result.byField.bg!.ratio).toBeCloseTo(15.59, 1);
    expect(result.byField.primary!.ratio).toBeCloseTo(5.25, 1);
    expect(result.byField.accent!.ratio).toBeCloseTo(11.09, 1);
    expect(result.byField.muted!.ratio).toBeCloseTo(5.77, 1);
  });

  it('takes the worst check when a field is in several', () => {
    const result = evaluateTheme(withColors({ surface: '#2A2D36' }));
    expect(result.byField.ink!.level).not.toBe('pass');
  });
});
