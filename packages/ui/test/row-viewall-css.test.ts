import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { repoRoot, scanCss } from './css-scan';

const css = readFileSync(resolve(repoRoot, 'packages/ui/src/components.css'), 'utf8');
const rules = scanCss(css);
const flat = (b?: string) => (b ?? '').replace(/\s+/g, ' ');
const inHover = (r: { at: string[] }) =>
  r.at.some((a) => a.includes('hover: hover') && a.includes('pointer: fine'));

describe('View all reveal and row snap (M41-S08, M41-S10)', () => {
  it('View all is hidden only on hover capable devices and is revealed by hover and focus', () => {
    const hide = rules.find((r) => r.selector === '.ad-row__all' && inHover(r));
    expect(flat(hide?.body)).toContain('opacity: 0');
    const reveal = rules.find(
      (r) => r.selector.includes('.ad-row:hover .ad-row__all') && inHover(r),
    );
    expect(reveal?.selector).toContain('.ad-row:focus-within .ad-row__all');
    expect(reveal?.selector).toContain('.ad-row__all:focus-visible');
    expect(flat(reveal?.body)).toContain('opacity: 1');
    const base = rules.find((r) => r.selector === '.ad-row__all' && r.at.length === 0);
    expect(base?.body).not.toMatch(/opacity:\s*0/);
  });

  it('snaps with mandatory on coarse pointers and proximity otherwise', () => {
    const base = rules.find((r) => r.selector === '.ad-row__list' && r.at.length === 0);
    expect(base?.body).toMatch(/scroll-snap-type:\s*x proximity/);
    const coarse = rules.find(
      (r) => r.selector === '.ad-row__list' && r.at.some((a) => a.includes('pointer: coarse')),
    );
    expect(coarse?.body).toMatch(/scroll-snap-type:\s*x mandatory/);
  });

  it('the viewport takes back the hover card padding so rows keep their spacing', () => {
    const pad = rules.find(
      (r) => r.selector.includes('.ad-row__viewport') && /--row-pad-block/.test(r.body),
    );
    expect(pad).toBeDefined();
    const viewport = rules.find(
      (r) => r.selector === '.ad-row__viewport' && /margin-block/.test(r.body),
    );
    expect(flat(viewport?.body)).toContain('margin-block: calc(-1 * var(--row-pad-block');
    const list = rules.find((r) => r.selector === '.ad-row__list' && /padding-block/.test(r.body));
    expect(flat(list?.body)).toContain('var(--row-pad-block');
    const head = rules.find((r) => r.selector === '.ad-row__head');
    expect(head?.body).toMatch(/position:\s*relative/);
    expect(head?.body).toMatch(/z-index:\s*1/);
  });

  it('the skeleton row reserves the height of a real row', () => {
    const skel = rules.find((r) => r.selector === '.ad-skelrow' && r.at.length === 0);
    expect(flat(skel?.body)).toContain('min-height: calc(');
    expect(flat(skel?.body)).toContain('var(--row-card-width)');
  });
});
