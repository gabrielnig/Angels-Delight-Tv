import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { repoRoot, scanCss } from './css-scan';

const read = (p: string) => readFileSync(resolve(repoRoot, p), 'utf8');
const rules = scanCss(read('packages/ui/src/components.css'));
const flat = (body?: string) =>
  (body ?? '').replace(/\s+/g, ' ').replace(/\( /g, '(').replace(/ \)/g, ')');
const sel = (s: string) => (r: { selector: string }) => r.selector.replace(/\s+/g, ' ') === s;

function containerCv(min: number): number | undefined {
  const hit = rules.filter(
    (r) =>
      r.selector.includes('.ad-row__viewport') &&
      r.at.some((a) => a.startsWith('@container row') && a.includes(`(min-width: ${min}px)`)),
  );
  const v = /--cards-visible:\s*([\d.]+)/.exec(hit[0]?.body ?? '')?.[1];
  return v ? Number(v) : undefined;
}

describe('row geometry (R11, M47-S01)', () => {
  it('the row is a size container named row', () => {
    const row = rules.find(sel('.ad-row'));
    expect(row?.body).toMatch(/container-type:\s*inline-size/);
    expect(row?.body).toMatch(/container-name:\s*row/);
  });

  it('column count follows the container at 0, 600, 960, 1280 and 1920', () => {
    expect([0, 600, 960, 1280, 1920].map(containerCv)).toEqual([2.3, 3.3, 4.3, 5.3, 6.3]);
  });

  it('card width uses container units and subtracts both gutters and the gaps once', () => {
    const body = rules.find(
      (r) => r.selector.includes('.ad-row__viewport') && /--row-card-width/.test(r.body),
    )?.body;
    expect(flat(body)).toContain(
      '(100cqw - 2 * var(--page-gutter) - (var(--cards-visible) - 1) * var(--card-gap)) / var(--cards-visible)',
    );
  });

  it('items take the card width token with a viewport fallback', () => {
    const item = rules.find(sel('.ad-row__item'));
    expect(flat(item?.body)).toMatch(/flex: 0 0 var\(--row-card-width, calc\(/);
  });

  it('the next card peeks 30 to 55 percent at every width from 360 to 2560', () => {
    const cv = (w: number) =>
      w >= 1920 ? 6.3 : w >= 1280 ? 5.3 : w >= 960 ? 4.3 : w >= 600 ? 3.3 : 2.3;
    for (const w of [360, 390, 600, 960, 1280, 1440, 1920, 2560]) {
      const container = Math.min(w, w >= 1920 ? 1920 : 1440);
      const gutter = Math.min(56, Math.max(16, 0.04 * w));
      const gap = w >= 960 ? 12 : 8;
      const n = cv(w);
      const card = (container - 2 * gutter - (n - 1) * gap) / n;
      const peek = container - (gutter + Math.floor(n) * (card + gap));
      expect(peek / card, String(w)).toBeGreaterThan(0.3);
      expect(peek / card, String(w)).toBeLessThan(0.55);
    }
  });

  it('arrows centre on the thumbnail, derived from the card width, not 25 percent', () => {
    const arrow = rules.find(sel('.ad-row__arrow'));
    expect(arrow?.body).toMatch(/top:\s*var\(--row-arrow-top, 25%\)/);
    const def = rules.find(
      (r) => r.selector.includes('.ad-row__viewport') && /--row-arrow-top/.test(r.body),
    );
    expect(flat(def?.body)).toContain(
      'calc(var(--space-1) + var(--row-card-width) * 9 / 32 - var(--touch-target) / 2)',
    );
  });

  it('arrows only render for fine pointers and the list uses native proximity snap', () => {
    const fine = rules.find(
      (r) => sel('.ad-row__arrow')(r) && r.at.some((a) => /pointer:\s*fine/.test(a)),
    );
    expect(fine?.body).toMatch(/display:\s*inline-flex/);
    const base = rules.find(sel('.ad-row__arrow'));
    expect(base?.body).toMatch(/display:\s*none/);
    const list = rules.find(sel('.ad-row__list'));
    expect(list?.body).toMatch(/scroll-snap-type:\s*x proximity/);
    expect(list?.body).toMatch(/scroll-padding:\s*0 var\(--page-gutter\)/);
  });
});
