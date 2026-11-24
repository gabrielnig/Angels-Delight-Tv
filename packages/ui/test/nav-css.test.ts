import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { repoRoot, scanCss } from './css-scan';

const css = readFileSync(resolve(repoRoot, 'packages/ui/src/components.css'), 'utf8');
const rules = scanCss(css);
const flat = (b?: string) =>
  (b ?? '').replace(/\s+/g, ' ').replace(/\( /g, '(').replace(/ \)/g, ')');
const find = (s: string) =>
  rules.find((r) => r.selector.replace(/\s+/g, ' ') === s && r.at.length === 0);

describe('nav layers (R35, M47-S04)', () => {
  it('the solid fade is an opacity transition on a layer, not a gradient swap', () => {
    const before = find('.ad-nav::before');
    expect(before?.body).toMatch(/opacity:\s*0/);
    expect(before?.body).toMatch(/background:\s*var\(--color-surface\)/);
    expect(flat(find('.ad-nav::before, .ad-nav::after')?.body)).toMatch(
      /transition: opacity var\(--motion-base\) linear/,
    );
    expect(find(".ad-nav[data-surface='solid']::before")?.body).toMatch(/opacity:\s*1/);
    expect(find(".ad-nav[data-surface='solid']::after")?.body).toMatch(/opacity:\s*0/);
  });

  it('the scrim holds 0.85 over the text band using the tokens', () => {
    const after = flat(find('.ad-nav::after')?.body);
    expect(after).toContain('var(--nav-scrim-hold)');
    expect(after).toContain('rgba(var(--scrim-rgb), var(--scrim-hero-start))');
  });

  it('text, underline and ring flip as one step at 35 percent of the fade', () => {
    expect(flat(find('.ad-nav')?.body)).toContain(
      'transition: color 1ms linear calc(var(--motion-base) * 0.65)',
    );
    const solid = find(".ad-nav[data-surface='solid']");
    expect(flat(solid?.body)).toContain('transition-delay: calc(var(--motion-base) * 0.35)');
    expect(solid?.body).toMatch(/--nav-underline:\s*var\(--color-primary\)/);
    expect(find('.ad-nav')?.body).toMatch(/--nav-underline:\s*var\(--color-focus-ring-dark\)/);
  });

  it('the current page underline is 3px and uses the nav underline colour', () => {
    expect(find(".ad-nav__link[aria-current='page']")?.body).toMatch(
      /box-shadow:\s*inset 0 -3px 0 var\(--nav-underline\)/,
    );
  });

  it('a hero page keeps its negative margin in both states so nothing jumps', () => {
    expect(find(".ad-nav[data-hero='true']")?.body).toMatch(
      /margin-bottom:\s*calc\(var\(--nav-height\) \* -1\)/,
    );
  });

  it('the soft skin and back variants keep their own surfaces', () => {
    expect(
      find(".ad-nav[data-skin='soft']::before, .ad-nav[data-skin='soft']::after")?.body,
    ).toMatch(/display:\s*none/);
    expect(find(".ad-nav[data-back='true']::before")?.body).toMatch(
      /background:\s*var\(--color-bg\)/,
    );
  });
});
