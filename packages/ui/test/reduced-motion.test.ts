import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { allRules, repoRoot } from './css-scan';

const tokens = readFileSync(resolve(repoRoot, 'packages/ui/src/tokens.css'), 'utf8');
const rules = allRules(['packages/ui/src']);

describe('reduced motion (M47-S07, R31)', () => {
  it('uses the reduce value and never no-preference or reduced', () => {
    expect(tokens).toMatch(/@media \(prefers-reduced-motion: reduce\)/);
    expect(tokens).not.toMatch(/prefers-reduced-motion:\s*(no-preference|reduced)/);
  });

  it('no hover scale stays active under reduce', () => {
    const reduce = rules.filter((r) => r.at.some((a) => /prefers-reduced-motion:\s*reduce/.test(a)));
    const scaling = rules.filter(
      (r) => /:hover/.test(r.selector) && /transform:\s*(?!none)/.test(r.body),
    );
    for (const hover of scaling) {
      const target = hover.selector;
      expect(
        reduce.some((r) => r.selector.includes(target) && /transform:\s*none/.test(r.body)),
        target,
      ).toBe(true);
    }
  });

  it('skeleton shimmer is replaced by a static fill', () => {
    const reduce = rules.filter((r) => r.at.some((a) => /prefers-reduced-motion:\s*reduce/.test(a)));
    const shimmer = reduce.find((r) => r.selector.includes('.ad-skeleton::after'));
    expect(shimmer?.body).toMatch(/animation:\s*none/);
    expect(shimmer?.body).toMatch(/display:\s*none/);
  });
});
