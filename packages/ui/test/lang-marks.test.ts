import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const tokens = readFileSync(resolve(__dirname, '../src/tokens.css'), 'utf8');
const components = readFileSync(resolve(__dirname, '../src/components.css'), 'utf8');
const all = `${tokens}\n${components}`;

describe('marks safe typography for yo, ig, ha and pcm (M46, R23)', () => {
  it('defines --leading-marks as 1.3', () => {
    expect(tokens).toMatch(/--leading-marks:\s*1\.3;/);
  });
  it('yo and ig headings use --leading-marks', () => {
    const rule = /:lang\(yo\)[^{]*h1[^{]*\{([^}]*)\}/.exec(all)?.[1] ?? '';
    expect(rule).toContain('line-height: var(--leading-marks)');
    expect(all).toMatch(/:lang\(ig\)[^{]*h1/);
  });
  it('micro labels have no letter spacing under yo and ig', () => {
    const rule = /:lang\(yo\)[^{]*\.ad-badge[^{]*\{([^}]*)\}/.exec(all)?.[1] ?? '';
    expect(rule).toMatch(/letter-spacing:\s*0/);
  });
  it('line clamped titles keep padding so a dot below is not cut', () => {
    expect(all).toMatch(/:lang\(yo\)[^{]*\.ad-card__title[^{]*\{[^}]*padding-block:\s*0\.1em/);
  });
});
