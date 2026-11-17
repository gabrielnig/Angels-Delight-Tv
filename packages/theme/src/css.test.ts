import { describe, expect, it } from 'vitest';
import { buildThemeCss, buildThemeVariables } from './css';
import { DEFAULT_THEME, parseTheme } from './model';

describe('buildThemeVariables', () => {
  it('emits themeable, font, scale and derived variables', () => {
    const vars = buildThemeVariables(DEFAULT_THEME);
    expect(vars['--color-primary']).toBe('#1F6FB5');
    expect(vars['--color-on-primary']).toBe('#FFFFFF');
    expect(vars['--color-on-accent']).toBe('#1A1C22');
    expect(vars['--font-sans']).toContain('"Inter"');
    expect(vars['--type-scale']).toBe('1');
    expect(vars['--radius-sm']).toBe('0.5rem');
    expect(vars['--row-gap']).toBe('var(--space-8)');
    expect(vars['--color-focus-ring']).toBeDefined();
    expect(vars['--color-border-strong']).toBeDefined();
  });

  it('never emits fixed tokens (status, sidebar, player)', () => {
    const names = Object.keys(buildThemeVariables(DEFAULT_THEME));
    expect(
      names.filter((name) => /success|danger|warning|sidebar|player|tile|scrim/.test(name)),
    ).toEqual([]);
  });

  it('only emits valid hex or known values', () => {
    for (const [name, value] of Object.entries(
      buildThemeVariables(parseTheme({ colors: { primary: '#2B7A4B' } })),
    )) {
      if (name.startsWith('--color-')) expect(value).toMatch(/^#[0-9A-F]{6}$/);
    }
  });

  it('uses the serif only for the display font when Lora is chosen', () => {
    const vars = buildThemeVariables(parseTheme({ fontKey: 'lora' }));
    expect(vars['--font-display']).toContain('"Lora"');
    expect(vars['--font-sans']).toContain('"Inter"');
  });
});

describe('buildThemeCss', () => {
  it('renders one :root block', () => {
    const css = buildThemeCss(DEFAULT_THEME);
    expect(css.startsWith(':root {')).toBe(true);
    expect(css.match(/:root/g)).toHaveLength(1);
    expect(css).toContain('--color-bg: #F5F5F2;');
  });

  it('cannot contain markup that closes a style element', () => {
    expect(buildThemeCss(DEFAULT_THEME)).not.toMatch(/[<>]/);
  });

  it('is stable for equal themes', () => {
    expect(buildThemeCss(parseTheme({}))).toBe(buildThemeCss(DEFAULT_THEME));
  });
});
