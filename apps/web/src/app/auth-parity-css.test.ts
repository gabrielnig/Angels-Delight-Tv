import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('./globals.css', import.meta.url), 'utf8');

function rule(selector: string): string {
  const start = css.indexOf(`\n${selector} {`);
  expect(start, `${selector} rule exists`).toBeGreaterThan(-1);
  return css.slice(start, css.indexOf('}', start));
}

describe('sign in parity with the mockup (S01)', () => {
  it('sets the brand panel headline in bold display weight and wraps it in two balanced lines', () => {
    const tagline = rule('.web-split__tagline');
    expect(tagline).toMatch(/font-weight:\s*var\(--weight-bold\)/);
    expect(tagline).toMatch(/max-width:\s*\d+(\.\d+)?ch/);
    expect(tagline).toMatch(/text-wrap:\s*balance/);
  });

  it('pushes the forgot password link to the end of the row and keeps a 44px target', () => {
    const link = rule('.web-link--end');
    expect(link).toMatch(/align-self:\s*flex-end/);
    expect(rule('.web-link')).toMatch(/min-height:\s*var\(--touch-target\)/);
  });

  it('centres the alternative sign up line under the button', () => {
    expect(rule('.web-form__alt')).toMatch(/text-align:\s*center/);
  });
});
