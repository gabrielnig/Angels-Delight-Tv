import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(join(__dirname, 'watch.css'), 'utf8');
const theatre = css.slice(css.indexOf('/* ---- theatre'));

describe('theatre mode styles (M43-S08)', () => {
  it('has theatre rules', () => {
    expect(css).toContain('[data-theatre]');
  });

  it('uses tokens and no hover only effects', () => {
    expect(theatre).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(/);
    expect(theatre).not.toMatch(/:hover/);
    expect(theatre).not.toMatch(/\b\d+ms\b/);
  });

  it('applies only from 960 px', () => {
    expect(theatre).toMatch(/@media \(min-width: 960px\)/);
    const outside = theatre.replace(/@media \(min-width: 960px\)\s*\{[\s\S]*$/, '');
    expect(outside).not.toMatch(/data-theatre/);
  });

  it('keeps 16 to 9 with a height cap and animates only transform and opacity', () => {
    expect(theatre).toMatch(/max-height:\s*80vh/);
    expect(theatre).not.toMatch(/transition:[^;]*(width|height|all)/);
  });

  it('does not animate under reduced motion', () => {
    expect(theatre).toMatch(/prefers-reduced-motion:\s*reduce/);
  });
});
