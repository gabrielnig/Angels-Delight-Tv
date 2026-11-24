import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('./globals.css', import.meta.url), 'utf8');

/** Column count of `.web-grid` in the media query for `minWidth`, or in the base rule when none. */
function gridColumns(minWidth?: number): string | null {
  const pattern =
    minWidth === undefined
      ? /\n\.web-grid \{[^}]*grid-template-columns:\s*repeat\((\d+),/
      : new RegExp(
          `@media \\(min-width: ${minWidth}px\\) \\{\\s*\\.web-grid \\{[^}]*grid-template-columns:\\s*repeat\\((\\d+),`,
        );
  return pattern.exec(css)?.[1] ?? null;
}

describe('list page grid columns (M41-S08)', () => {
  it('shows 2 across on phones, then 3, 4 and 5 across at 640, 960 and 1280', () => {
    expect(gridColumns()).toBe('2');
    expect(gridColumns(640)).toBe('3');
    expect(gridColumns(960)).toBe('4');
    expect(gridColumns(1280)).toBe('5');
  });

  it('shows 6 across from 1920', () => {
    expect(gridColumns(1920)).toBe('6');
  });
});

describe('list page skeleton geometry', () => {
  it('reserves height so the grid does not shift when cards arrive', () => {
    const start = css.indexOf('.web-list-skeleton {');
    expect(start).toBeGreaterThan(-1);
    const rule = css.slice(start, css.indexOf('}', start));
    expect(rule).toMatch(/min-height:\s*[^;]+;/);
  });

  it('lets skeleton cards fill grid cells instead of the row basis', () => {
    const start = css.indexOf('.web-grid .ad-skelcard {');
    expect(start).toBeGreaterThan(-1);
    expect(css.slice(start, css.indexOf('}', start))).toMatch(/flex:\s*1 1 auto/);
  });
});

describe('kids rows (R11)', () => {
  const kidsAt = (minWidth?: number) => {
    const opener = minWidth === undefined ? '' : `@media (min-width: ${minWidth}px) {\\s*`;
    const re = new RegExp(`${opener}\\.web-shell\\[data-kids='true'\\] \\{\\s*--cards-visible:\\s*([\\d.]+);`);
    return re.exec(css)?.[1] ?? null;
  };

  it('shows 2.3 cards on a phone, not 2.1, so the next card still peeks', () => {
    expect(kidsAt()).toBe('2.3');
  });

  it('keeps larger cards than the adult rows from 600 px up', () => {
    expect(Number(kidsAt(600))).toBeLessThan(3.3);
    expect(Number(kidsAt(960))).toBeLessThan(4.3);
    expect(Number(kidsAt(1280))).toBeLessThan(5.3);
  });
});
