import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { repoRoot, scanCss } from './css-scan';

const css = readFileSync(resolve(repoRoot, 'packages/ui/src/components.css'), 'utf8');
const rules = scanCss(css);
const flat = (b?: string) => (b ?? '').replace(/\s+/g, ' ');
const rule = (s: string, at = false) =>
  rules.find((r) => r.selector === s && (at ? r.at.length > 0 : r.at.length === 0));

describe('tab bar tokens (M47-S14, F14)', () => {
  it('the bar height token includes the safe area inset', () => {
    expect(flat(rule('.ad-tabbar')?.body)).toContain(
      'height: calc(var(--tabbar-height) + env(safe-area-inset-bottom))',
    );
  });

  it('the footer clears the bar by token, not a literal', () => {
    const footer = rules.find((r) => r.selector === '.ad-footer' && /--tabbar-height/.test(r.body));
    expect(flat(footer?.body)).toContain(
      'calc(var(--space-8) + var(--tabbar-height) + env(safe-area-inset-bottom))',
    );
    expect(css).not.toMatch(/calc\(3\.5rem \+ env|var\(--space-8\) \+ 4rem/);
  });

  it('the bar hides from 960px', () => {
    const hidden = rules.find(
      (r) => r.selector === '.ad-tabbar' && r.at.some((a) => /min-width: 960px/.test(a)),
    );
    expect(hidden?.body).toMatch(/display:\s*none/);
  });

  it('items are 44px or taller with a 3px current marker', () => {
    expect(rule('.ad-tabbar__item')?.body).toMatch(/min-height:\s*var\(--touch-target\)/);
    expect(rule('.ad-tabbar__item')?.body).toMatch(/border-top:\s*3px solid transparent/);
    expect(rule(".ad-tabbar__item[aria-current='page']")?.body).toMatch(
      /border-top-color:\s*var\(--color-primary\)/,
    );
  });
});
