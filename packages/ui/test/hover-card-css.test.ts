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
  it('the hover delay applies on enter only, mouse out is not delayed', () => {
    const base = find('.ad-card__thumb');
    expect(base?.body).not.toMatch(/hover-card-delay|hover-intent-delay/);
    const hover = find('.ad-card:hover .ad-card__thumb', HOVER);
    expect(hover?.body).toMatch(/transition-delay:\s*var\(--hover-card-delay\)/);
  });

  it('scale is --card-scale over 250ms with the strong ease out', () => {
    const base = find('.ad-card__thumb', /container row \(min-width: 600px\)/);
    expect(flat(base?.body)).toMatch(
      /transition: transform var\(--motion-hover\) var\(--ease-out-strong\)/,
    );
    const hover = find('.ad-card:hover .ad-card__thumb', HOVER);
    expect(hover?.body).toMatch(/transform:\s*scale\(var\(--card-scale\)\)/);
    expect(css).not.toMatch(/translateY\(-4px\)/);
  });

  it('only exists for fine hover pointers on rows 600px or wider', () => {
    const hover = find('.ad-card:hover .ad-card__thumb', HOVER);
    expect(hover?.at.some((a) => /container row \(min-width: 600px\)/.test(a))).toBe(true);
  });

  it('first item grows from the left, last from the right, others from the centre', () => {
    expect(find('.ad-card__thumb')?.body).toMatch(/transform-origin:\s*center/);
    expect(find('.ad-row__item:first-child .ad-card__thumb')?.body).toMatch(
      /transform-origin:\s*left center/,
    );
    expect(find('.ad-row__item:last-child .ad-card__thumb')?.body).toMatch(
      /transform-origin:\s*right center/,
    );
  });

  it('the raised item sits above its neighbours', () => {
    const item = find('.ad-row__item:hover', HOVER);
    expect(item?.body).toMatch(/position:\s*relative/);
    expect(item?.body).toMatch(/z-index:\s*var\(--z-sticky\)/);
  });

  it('title and meta fade out under the scaled thumb after the delay', () => {
    const fade = find('.ad-card:hover .ad-card__title, .ad-card:hover .ad-card__meta', HOVER);
    expect(fade?.body).toMatch(/opacity:\s*0/);
    expect(fade?.body).toMatch(/transition-delay:\s*var\(--hover-card-delay\)/);
  });

  it('keyboard focus shows the same peek with no scale and no delay', () => {
    const focus = find('.ad-card:focus-within .ad-card__peek');
    expect(focus?.body).toMatch(/opacity:\s*1/);
    expect(focus?.body).not.toMatch(/transform/);
  });

  it('reduce removes the scale', () => {
    const reduce = find('.ad-card:hover .ad-card__thumb', /prefers-reduced-motion:\s*reduce/);
    expect(reduce?.body).toMatch(/transform:\s*none/);
  });

  it('the row list has real block padding for the scale, no negative margin', () => {
    const list = rules.find((r) => r.selector === '.ad-row__list' && /padding-block/.test(r.body));
    expect(flat(list?.body)).toContain(
      'padding-block: calc(var(--row-card-width) * 9 / 16 * (var(--card-scale) - 1) / 2)',
    );
    expect(css).not.toMatch(/margin-(block|top|bottom):\s*calc\(-/);
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
