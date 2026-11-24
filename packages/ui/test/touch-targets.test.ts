import { describe, expect, it } from 'vitest';
import { allRules } from './css-scan';

const rules = allRules();
const declared = (selector: string, prop: string) =>
  rules
    .filter((r) => r.selector.replace(/\s+/g, ' ') === selector)
    .map((r) => new RegExp(`(?:^|[;\\s])${prop}:\\s*([^;]+);`).exec(r.body)?.[1]?.trim())
    .filter((v): v is string => Boolean(v));

describe('touch targets (M47-S06, R30)', () => {
  it('seek bar hit area is the 44px touch target', () => {
    expect(declared('.adp-seek', 'height')).toEqual(['var(--touch-target)']);
  });
});
