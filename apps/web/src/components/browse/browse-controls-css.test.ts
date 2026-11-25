import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(resolve(__dirname, 'browse-controls.css'), 'utf8');

describe('browse controls stylesheet contract (L11 slice 2)', () => {
  it('pins the stack under the nav with tokens only', () => {
    expect(css).toMatch(/\.web-browse-stack\s*\{[^}]*position:\s*sticky/);
    expect(css).toMatch(/top:\s*var\(--nav-height\)/);
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(/);
  });
  it('hides the bar with transform and opacity only, and not at all under reduced motion', () => {
    const rule = css.match(/\.web-browse-bar\[data-hidden='true'\]\s*\{[^}]*\}/)?.[0] ?? '';
    expect(rule).toMatch(/transform:\s*translateY\(-100%\)/);
    expect(rule).toMatch(/visibility:\s*hidden/);
    expect(css).toMatch(/prefers-reduced-motion: reduce\)\s*\{\s*\.web-browse-bar\s*\{\s*transition:\s*none/);
    const transitions = [...css.matchAll(/transition:([^;]*);/g)].map((m) => m[1]);
    for (const t of transitions) expect(t).not.toMatch(/\b(height|width|top|left|margin)\b/);
  });
  it('keeps hover inside a hover query and draws a focus ring on every control', () => {
    expect(css).toMatch(/@media \(hover: hover\) and \(pointer: fine\)\s*\{\s*\.web-menu__button:hover/);
    expect(css).not.toMatch(/^\.web-menu__button:hover/m);
    for (const cls of ['web-menu__button', 'web-menu__option', 'web-browse-bar__clear'])
      expect(css).toMatch(new RegExp(`\\.${cls}:focus-visible`));
    expect(css).toMatch(/--color-focus-ring/);
  });
  it('gives every control a 44 px target', () => {
    for (const cls of ['web-menu__button', 'web-menu__option', 'web-browse-bar__clear'])
      expect(css).toMatch(new RegExp(`\\.${cls}\\s*\\{[^}]*min-height:\\s*var\\(--touch-target\\)`));
  });
  it('draws the set, loading and open states', () => {
    for (const s of ['is-set', 'is-loading', "aria-expanded='true'", "aria-checked='true'"])
      expect(css).toContain(s);
  });
});
