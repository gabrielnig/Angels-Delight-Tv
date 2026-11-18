import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('./admin.css', import.meta.url), 'utf8');

function block(selector: string): string {
  const start = css.indexOf(`\n${selector} {`);
  expect(start, `${selector} rule exists`).toBeGreaterThan(-1);
  return css.slice(start, css.indexOf('}', start));
}

describe('admin link targets are 44px (design review finding)', () => {
  it.each(['.adm-list__title', '.adm-vtitle', '.adm-crumbs a'])('%s', (selector) => {
    expect(block(selector)).toMatch(/min-height:\s*var\(--touch-target\)/);
  });
});
