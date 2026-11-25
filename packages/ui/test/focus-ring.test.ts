import { describe, expect, it } from 'vitest';
import { allRules, type CssRule } from './css-scan';

const rules = allRules();
const uiRules = rules.filter((r) => r.file === 'packages/ui/src/components.css');
const find = (selector: string, from: CssRule[] = uiRules) =>
  from.filter((r) => r.selector.replace(/\s+/g, ' ') === selector);

/** `outline: none` is allowed only where a replacement ring is drawn elsewhere. Each entry says where. */
const ALLOWED_OUTLINE_NONE: Record<string, string> = {
  '.web-main:focus-visible': 'programmatic focus landmark (tabindex -1)',
  '.web-authpage__main:focus-visible': 'programmatic focus landmark (tabindex -1)',
  '.web-profiles:focus-visible': 'programmatic focus landmark (tabindex -1)',
  '.auth-body:focus-visible': 'programmatic focus landmark (tabindex -1)',
  '.adp': 'player root, ring drawn by .adp:focus-visible',
  '.acct-search input': 'wrapper draws the ring with :focus-within',
  '.web-search__input:focus': 'wrapper draws the ring with :focus-within',
  '.auth-input:focus, .auth-input:focus-visible': '2px border plus a 3px offset box-shadow ring',
  '.ad-tile:focus-visible': 'ring moves to the avatar child',
  '.ad-card__link:focus-visible': 'ring moves to the thumb child',
  '.web-rail__link:focus-visible': 'ring moves to the chip child (.web-rail__link:focus-visible .web-rail__chip)',
  '.hlp-search__field input:focus': 'wrapper draws the ring with .hlp-search__field:focus-within',
  '.hlp-panel': 'dialog root, ring drawn by .hlp-panel:focus-visible',
};

describe('focus rings (M47-S06, R37)', () => {
  it('every outline none is listed with the place of its replacement ring', () => {
    const offenders = rules
      .filter((r) => /outline:\s*(none|0)\s*;/.test(r.body))
      .map((r) => r.selector.replace(/\s+/g, ' '))
      .filter((s) => !(s in ALLOWED_OUTLINE_NONE));
    expect(offenders).toEqual([]);
  });

  it('tile focus draws an outline with a 2px offset on the avatar, not a bare box-shadow', () => {
    const ring = find('.ad-tile:focus-visible .ad-tile__avatar');
    expect(ring).toHaveLength(1);
    expect(ring[0]?.body).toMatch(/outline:\s*3px solid var\(--color-focus-ring\)/);
    expect(ring[0]?.body).toMatch(/outline-offset:\s*2px/);
    expect(ring[0]?.body).toMatch(/box-shadow:\s*none/);
  });

  it('the bell popover draws the offset focus outline and keeps it in forced colors', () => {
    const ring = find('.ad-bell__popover:focus-visible').filter((r) => r.at.length === 0);
    expect(ring).toHaveLength(1);
    expect(ring[0]?.body).toMatch(/outline:\s*3px solid var\(--color-focus-ring\)/);
    expect(ring[0]?.body).toMatch(/outline-offset:\s*2px/);
    const forced = uiRules.filter(
      (r) =>
        r.at.some((a) => /forced-colors:\s*active/.test(a)) &&
        r.selector.includes('.ad-bell__popover:focus-visible'),
    );
    expect(forced[0]?.body).toMatch(/outline-color:\s*Highlight/);
  });

  it('tile and card rings survive forced colors', () => {
    const forced = (sel: string) =>
      uiRules.filter(
        (r) => r.at.some((a) => /forced-colors:\s*active/.test(a)) && r.selector.includes(sel),
      );
    expect(forced('.ad-tile:focus-visible .ad-tile__avatar')[0]?.body).toMatch(
      /outline-color:\s*Highlight/,
    );
    expect(forced('.ad-card__link:focus-visible .ad-card__thumb')[0]?.body).toMatch(
      /outline-color:\s*Highlight/,
    );
  });

  it('tile hover ring keeps a transparent outline so it shows in forced colors', () => {
    const hover = uiRules.filter((r) => r.selector === '.ad-tile:hover .ad-tile__avatar');
    expect(hover[0]?.body).toMatch(/outline:\s*3px solid transparent/);
  });
});
