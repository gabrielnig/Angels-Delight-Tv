import { describe, expect, it } from 'vitest';
import { allRules, mediaIncludesFine, mediaIncludesHover, scanCss } from './css-scan';

const rules = allRules().filter((r) => /:hover/.test(r.selector));
const label = (r: { file: string; line: number; selector: string }) =>
  `${r.file}:${r.line} ${r.selector.replace(/\s+/g, ' ')}`;

describe('css scanner', () => {
  it('tracks nested at-rules and ignores comments', () => {
    const found = scanCss(
      '/* a:hover {x:1} */\n@media (hover: hover) { @container row (min-width: 600px) { .a:hover { color: red; } } }\n.b { color: blue; }',
    );
    expect(found.map((r) => r.selector)).toEqual(['.a:hover', '.b']);
    expect(found[0]?.at).toEqual(['@media (hover: hover)', '@container row (min-width: 600px)']);
    expect(found[0]?.line).toBe(2);
  });
});

describe('hover guard (M47-S02, R31)', () => {
  it('finds hover rules to guard', () => {
    expect(rules.length).toBeGreaterThan(20);
  });

  it('no :hover rule sits outside @media (hover: hover)', () => {
    const bad = rules
      .filter((r) => !mediaIncludesHover(r.at))
      // Reduce blocks only switch hover movement off, they never add it.
      .filter((r) => !r.at.some((a) => /prefers-reduced-motion:\s*reduce/.test(a)))
      .map(label);
    expect(bad).toEqual([]);
  });

  it('hover rules that move, scale or reveal need (hover: hover) and (pointer: fine)', () => {
    const bad = rules
      .filter((r) => /\b(transform|scale|translate|opacity|visibility)\s*:/.test(r.body))
      .filter(
        (r) =>
          !/:\s*none\b/.test(r.body.replace(/transition[^;]*;/g, '')) ||
          /transform:\s*(?!none)/.test(r.body),
      )
      .filter((r) => !r.at.some((a) => /prefers-reduced-motion:\s*reduce/.test(a)))
      .filter((r) => !mediaIncludesFine(r.at))
      .map(label);
    expect(bad).toEqual([]);
  });
});
