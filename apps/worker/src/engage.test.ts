import { describe, expect, it } from 'vitest';
import { DEFAULT_RATING_RULES, pickMostLiked, wilsonLowerBound, type RatingCounts } from './engage';

const row = (key: string, likes: number, loves: number, dislikes: number): RatingCounts => ({
  key,
  likes,
  loves,
  dislikes,
});

describe('wilsonLowerBound', () => {
  it('is 0 with no votes and grows with evidence at the same share', () => {
    expect(wilsonLowerBound(0, 0)).toBe(0);
    expect(wilsonLowerBound(9, 10)).toBeLessThan(wilsonLowerBound(90, 100));
    expect(wilsonLowerBound(10, 10)).toBeLessThanOrEqual(1);
  });
});

describe('pickMostLiked', () => {
  const rules = DEFAULT_RATING_RULES;

  it('needs the minimum raters and the minimum positive share', () => {
    const picked = pickMostLiked(
      [row('few', 5, 4, 0), row('unloved', 5, 3, 7), row('good', 20, 10, 1)],
      rules,
    );
    expect([...picked]).toEqual(['good']);
  });

  it('a single eligible title still gets one label', () => {
    expect([...pickMostLiked([row('only', 8, 4, 0)], rules)]).toEqual(['only']);
  });

  it('labels the top quarter of eligible titles, at most the cap, and breaks ties on loves', () => {
    const eligible = Array.from({ length: 12 }, (_, i) => row(`t${i}`, 20 + i, 0, 1));
    expect(pickMostLiked(eligible, rules).size).toBe(3);
    const many = Array.from({ length: 80 }, (_, i) => row(`m${i}`, 30 + i, 0, 0));
    expect(pickMostLiked(many, { ...rules, maxLabelled: 5 }).size).toBe(5);
    const tied = pickMostLiked(
      [row('likes', 20, 0, 0), row('loves', 10, 10, 0), row('x1', 20, 0, 0), row('x2', 20, 0, 0)],
      rules,
    );
    expect(tied.has('loves')).toBe(true);
    expect(tied.size).toBe(1);
  });

  it('returns nothing for no ratings', () => {
    expect(pickMostLiked([], rules).size).toBe(0);
  });
});
