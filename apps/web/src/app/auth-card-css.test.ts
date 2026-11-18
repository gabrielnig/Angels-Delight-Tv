import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('./globals.css', import.meta.url), 'utf8');

describe('auth card surface (S01, S02)', () => {
  it('every auth card has a white surface, border and shadow, on sign in as well as the centred pages', () => {
    const start = css.indexOf('\n.web-authcard {');
    const rule = css.slice(start, css.indexOf('}', start));
    expect(rule).toMatch(/background:\s*var\(--color-surface\)/);
    expect(rule).toMatch(/border:\s*1px solid var\(--color-border\)/);
    expect(rule).toMatch(/box-shadow:\s*var\(--shadow-[12]\)/);
  });
});
