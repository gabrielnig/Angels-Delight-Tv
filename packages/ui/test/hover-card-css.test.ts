import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { repoRoot, scanCss } from './css-scan';

const read = (p: string) => readFileSync(resolve(repoRoot, p), 'utf8');
const css = read('packages/ui/src/components.css');
const rules = scanCss(css);
const flat = (b?: string) =>
  (b ?? '').replace(/\s+/g, ' ').replace(/\( /g, '(').replace(/ \)/g, ')');
const find = (selector: string, at?: RegExp) =>
  rules.find(
    (r) =>
      r.selector.replace(/\s+/g, ' ') === selector &&
      (at ? r.at.some((a) => at.test(a)) : r.at.length === 0),
  );
const HOVER = /hover:\s*hover.*pointer:\s*fine/;

describe('hover card (R10, M47-S03)', () => {
  it('the old inline scale, peek and fades are gone (M41-S12)', () => {
    expect(find('.ad-card:hover .ad-card__thumb', HOVER)).toBeUndefined();
    expect(find('.ad-card__thumb')?.body).not.toMatch(/transform-origin/);
    expect(find('.ad-row__item:hover', HOVER)).toBeUndefined();
    expect(find('.ad-card:hover .ad-card__title, .ad-card:hover .ad-card__meta', HOVER)).toBeUndefined();
    expect(css).not.toContain('ad-card__peek');
    expect(css).not.toMatch(/translateY\(-4px\)/);
  });

  it('the floating card sits above rows and the nav, in the body, on tokens', () => {
    const card = find('.ad-hovercard');
    expect(card?.body).toMatch(/position:\s*fixed/);
    expect(card?.body).toMatch(/z-index:\s*var\(--z-overlay\)/);
    expect(card?.body).toMatch(/box-shadow:\s*var\(--shadow-3\)/);
  });

  it('fades in over --motion-hover with the strong ease out, opacity only', () => {
    expect(flat(find('.ad-hovercard')?.body)).toMatch(
      /animation: ad-hovercard-in var\(--motion-hover\) var\(--ease-out-strong\)/,
    );
    expect(css).toMatch(/@keyframes ad-hovercard-in \{\s*from \{\s*opacity: 0;/);
  });

  it('reduce draws no animation, and the card carries no scale of its own in css', () => {
    expect(find(".ad-hovercard[data-motion='reduced']")?.body).toMatch(/animation:\s*none/);
    expect(find('.ad-hovercard')?.body).not.toMatch(/transform/);
  });

  it('the row list has real block padding for the scale, and only the viewport takes it back', () => {
    const pad = rules.find((r) => /--row-pad-block:\s*calc/.test(r.body));
    expect(flat(pad?.body)).toContain(
      '--row-pad-block: calc(var(--row-card-width) * 9 / 16 * (var(--card-scale) - 1) / 2)',
    );
    const list = rules.find((r) => r.selector === '.ad-row__list' && /padding-block/.test(r.body));
    expect(flat(list?.body)).toContain('padding-block: var(--row-pad-block');
    const negative = rules.filter((r) => /margin-(block|top|bottom):\s*calc\(-/.test(r.body));
    expect(negative.map((r) => r.selector)).toEqual(['.ad-row__viewport']);
  });

  it('growth per side fits the gutter from 600 up', () => {
    for (const w of [600, 768, 959, 960, 1279, 1280, 1920, 2560]) {
      const container = Math.min(w, w >= 1920 ? 1920 : 1440);
      const gutter = Math.min(56, Math.max(16, 0.04 * w));
      const n = w >= 1920 ? 6.3 : w >= 1280 ? 5.3 : w >= 960 ? 4.3 : 3.3;
      const gap = w >= 960 ? 12 : 8;
      const card = (container - 2 * gutter - (n - 1) * gap) / n;
      expect(0.125 * card, String(w)).toBeLessThanOrEqual(gutter);
    }
  });

  it('no rule reads the old hover intent delay', () => {
    expect(css).not.toContain('--hover-intent-delay');
  });
});

describe('caption badge (R38, F2)', () => {
  it('uses surface fill with ink text and border, not ink on a dark scrim', () => {
    const cc = find('.ad-card__cc');
    expect(cc?.body).toMatch(/background:\s*var\(--color-surface\)/);
    expect(cc?.body).toMatch(/color:\s*var\(--color-ink\)/);
    expect(cc?.body).toMatch(/border:\s*1px solid var\(--color-ink\)/);
    expect(cc?.body).toMatch(/border-radius:\s*var\(--radius-xs\)/);
  });
});
