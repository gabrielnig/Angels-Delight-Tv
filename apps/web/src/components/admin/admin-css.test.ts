import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('./admin.css', import.meta.url), 'utf8');

function block(selector: string): string {
  const start = css.indexOf(`\n${selector} {`);
  expect(start, `${selector} rule exists`).toBeGreaterThan(-1);
  return css.slice(start, css.indexOf('}', start));
}

describe('admin link targets are 44px (design review finding)', () => {
  it.each(['.adm-list__title', '.adm-vtitle'])('%s', (selector) => {
    expect(block(selector)).toMatch(/min-height:\s*var\(--touch-target\)/);
  });
});

describe('layout rules (L3-01)', () => {
  it('a list that is also a card keeps horizontal padding', () => {
    expect(css).toMatch(/\n\.adm-card\.adm-list \{[^}]*padding:\s*var\(--space-1\) var\(--space-4\)/);
  });

  it('numeric table headers use a rule at least as specific as the th reset', () => {
    expect(css).toMatch(/\.adm-table th\.adm-num/);
    expect(css).toMatch(/\.adm-table td\.adm-num/);
    expect(css).toMatch(/\.adm-table th\.adm-ctr/);
    expect(css).toMatch(/\.adm-table th\.adm-actions/);
    expect(css.indexOf('.adm-table th.adm-num')).toBeGreaterThan(css.indexOf('\n.adm-table th {'));
  });

  it('table cards scroll sideways instead of clipping', () => {
    expect(block('.adm-table-card')).toMatch(/overflow-x:\s*auto/);
    expect(css).toMatch(/\.adm-table--always \{[^}]*display:\s*table/);
  });
});
