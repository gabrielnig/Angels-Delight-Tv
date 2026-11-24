import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FONT_KEYS, ThemeValidationError, renderThemeCss, themeVariables } from './theme';

const repoRoot = resolve(import.meta.dirname, '../../..');
const tokensCss = readFileSync(resolve(import.meta.dirname, 'tokens.css'), 'utf8');

describe('tokens.css', () => {
  // Skipped until the owner copies tokens.css into the skill reference (L8 follow up, docs/lanes/L8-build.md).
  it.skip('is the same file as the design system skill reference', () => {
    const reference = readFileSync(
      resolve(repoRoot, '.claude/skills/angels-delight-design-system/reference/tokens.css'),
      'utf8',
    );
    expect(tokensCss).toBe(reference);
  });
});

describe('themeVariables', () => {
  it('returns no overrides for an empty theme so the defaults in tokens.css apply', () => {
    expect(themeVariables({})).toEqual({});
  });

  it('maps colours to the themeable colour variables', () => {
    expect(themeVariables({ colors: { primary: '#0A5C36', accent: '#F4B400' } })).toEqual({
      '--color-primary': '#0A5C36',
      '--color-accent': '#F4B400',
    });
  });

  it('upper cases hex so the stored and rendered values compare equal', () => {
    expect(themeVariables({ colors: { bg: '#f5f5f2' } })['--color-bg']).toBe('#F5F5F2');
  });

  it.each([
    'red',
    '#fff',
    '#GGGGGG',
    'rgb(0,0,0)',
    '#1F6FB5; background: url(x)',
    'url(javascript:x)',
    '#1F6FB5FF',
  ])('rejects the colour %s', (value) => {
    expect(() => themeVariables({ colors: { primary: value } })).toThrow(ThemeValidationError);
  });

  it('rejects a colour key outside the themeable set', () => {
    expect(() => themeVariables({ colors: { danger: '#B42318' } as never })).toThrow(
      ThemeValidationError,
    );
  });

  it('maps an allowlisted font key to its self hosted stack', () => {
    const vars = themeVariables({ fontKey: 'poppins' });
    expect(vars['--font-sans']).toMatch(/^"Poppins", /);
    expect(vars['--font-sans']).toContain('system-ui');
  });

  it('knows exactly the six fonts from the design system', () => {
    expect([...FONT_KEYS].sort()).toEqual([
      'dm-sans',
      'inter',
      'lora',
      'nunito',
      'poppins',
      'space-grotesk',
    ]);
    expect(themeVariables({ fontKey: 'space-grotesk' })['--font-sans']).toMatch(/^"Space Grotesk", /);
  });

  it('rejects a font key that is not allowlisted', () => {
    expect(() => themeVariables({ fontKey: 'comic-sans' as never })).toThrow(ThemeValidationError);
  });

  it('accepts a type scale between 0.9 and 1.15 and rejects values outside it', () => {
    expect(themeVariables({ typeScale: 1.1 })).toEqual({ '--type-scale': '1.1' });
    expect(() => themeVariables({ typeScale: 0.85 })).toThrow(ThemeValidationError);
    expect(() => themeVariables({ typeScale: 1.2 })).toThrow(ThemeValidationError);
    expect(() => themeVariables({ typeScale: Number.NaN })).toThrow(ThemeValidationError);
  });

  it('scales the radius tokens from a radius factor', () => {
    const vars = themeVariables({ radiusScale: 0 });
    expect(vars['--radius-sm']).toBe('0rem');
    expect(vars['--radius-lg']).toBe('0rem');
    expect(themeVariables({ radiusScale: 2 })['--radius-sm']).toBe('1rem');
  });

  it('rejects a radius factor outside 0 to 2', () => {
    expect(() => themeVariables({ radiusScale: 3 })).toThrow(ThemeValidationError);
  });

  it('maps density to the row gap', () => {
    expect(themeVariables({ density: 'compact' })['--row-gap']).toBe('var(--space-6)');
    expect(themeVariables({ density: 'spacious' })['--row-gap']).toBe('var(--space-12)');
    expect(() => themeVariables({ density: 'tiny' as never })).toThrow(ThemeValidationError);
  });

  it('lists every problem at once', () => {
    try {
      themeVariables({ colors: { primary: 'red' }, typeScale: 5 });
    } catch (error) {
      expect((error as ThemeValidationError).issues.map((issue) => issue.field)).toEqual([
        'colors.primary',
        'typeScale',
      ]);
      return;
    }
    throw new Error('expected a throw');
  });
});

describe('themeVariables and tokens.css agree', () => {
  it('only writes variables that tokens.css declares', () => {
    const vars = themeVariables({
      colors: {
        bg: '#FFFFFF',
        surface: '#FFFFFF',
        ink: '#000000',
        muted: '#555555',
        border: '#DDDDDD',
        primary: '#1F6FB5',
        accent: '#FFC93C',
      },
      fontKey: 'inter',
      typeScale: 1,
      radiusScale: 1,
      density: 'comfortable',
    });
    const undeclared = Object.keys(vars).filter((name) => !tokensCss.includes(`${name}:`));
    expect(undeclared).toEqual([]);
  });
});

describe('renderThemeCss', () => {
  it('renders a root rule with one declaration per variable', () => {
    expect(renderThemeCss({ colors: { primary: '#0A5C36' }, typeScale: 1.05 })).toBe(
      ':root {\n  --color-primary: #0A5C36;\n  --type-scale: 1.05;\n}\n',
    );
  });

  it('renders nothing for an empty theme', () => {
    expect(renderThemeCss({})).toBe('');
  });
});
