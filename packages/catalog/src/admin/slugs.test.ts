import { describe, expect, it } from 'vitest';
import { slugProblem } from './slugs';

describe('slugProblem (M04-S02)', () => {
  it('accepts plain lower case slugs', () => {
    expect(slugProblem('rivers-of-nigeria')).toBeNull();
    expect(slugProblem('abc')).toBeNull();
  });

  it('refuses words that are routes of the site, in any case of the rule', () => {
    for (const word of ['admin', 'api', 'watch', 'sign-in', 'account']) {
      expect(slugProblem(word), word).toMatch(/reserved/i);
    }
  });

  it('refuses bad shapes with a reason an editor can act on', () => {
    expect(slugProblem('ab')).toMatch(/3 to 120/);
    expect(slugProblem('Has Space')).toMatch(/lower case/);
    expect(slugProblem('double--hyphen')).toMatch(/lower case/);
  });
});
