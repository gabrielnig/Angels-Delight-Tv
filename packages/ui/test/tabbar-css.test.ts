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

describe('tab bar states and label cap (L12, S183 frame 12, S184)', () => {
  it('a long label is clipped with an ellipsis inside its cell and never wraps', () => {
    const item = flat(rule('.ad-tabbar__item')?.body);
    expect(item).toContain('min-width: 0');
    const label = flat(rule('.ad-tabbar__item span')?.body);
    expect(label).toContain('max-width: 100%');
    expect(label).toContain('overflow: hidden');
    expect(label).toContain('text-overflow: ellipsis');
    expect(label).toContain('white-space: nowrap');
  });

  it('focus draws a 3px ring inside the item because the bar touches the screen edges (R37)', () => {
    const focus = flat(rule('.ad-tabbar__item:focus-visible')?.body);
    expect(focus).toContain('outline: 3px solid var(--color-focus-ring)');
    expect(focus).toContain('outline-offset: -3px');
  });

  it('pressed fills at once and hover sits inside the fine pointer query', () => {
    const pressed = flat(rule('.ad-tabbar__item:active')?.body);
    expect(pressed).toContain('background: var(--color-surface-sunken)');
    const hover = rules.find((r) => r.selector === '.ad-tabbar__item:hover');
    expect(hover?.at.some((a) => /hover: hover/.test(a))).toBe(true);
  });

  it('landscape phones get a 44px bar with the label beside the icon (S185)', () => {
    const landscape = rules.find(
      (r) =>
        r.selector === '.ad-tabbar__item' && r.at.some((a) => /orientation: landscape/.test(a)),
    );
    expect(flat(landscape?.body)).toContain('flex-direction: row');
    const token = rules.find(
      (r) => r.selector === ':root' && r.at.some((a) => /orientation: landscape/.test(a)),
    );
    expect(flat(token?.body)).toContain('--tabbar-height: var(--touch-target)');
  });
});
