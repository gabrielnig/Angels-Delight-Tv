import { describe, expect, it } from 'vitest';
import { assertWithinCap } from './usage';

describe('assertWithinCap', () => {
  it('a cap of 0 disables API use', () => {
    expect(() => assertWithinCap({ used: 0, adding: 10, cap: 0 })).toThrow(/not allowed|disabled|cap/i);
  });
  it('a job that would cross the monthly cap is refused before any call', () => {
    expect(() => assertWithinCap({ used: 95_000, adding: 6_000, cap: 100_000 })).toThrow(/monthly/i);
  });
  it('a job under the cap passes', () => {
    expect(() => assertWithinCap({ used: 10, adding: 10, cap: 100 })).not.toThrow();
  });
});
