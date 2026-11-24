import { describe, expect, it } from 'vitest';
import { MIN_RATINGS_FOR_SHARE, positiveShare, totalRatings } from './ratings';

describe('positiveShare', () => {
  it('is Like plus Love over all ratings, as a whole percent', () => {
    expect(positiveShare({ likes: 6, loves: 2, dislikes: 2 })).toBe(80);
    expect(positiveShare({ likes: 0, loves: 0, dislikes: 10 })).toBe(0);
    expect(positiveShare({ likes: 1, loves: 1, dislikes: 8 })).toBe(20);
  });
  it('is null under ten ratings so a tiny sample is never shown as a share', () => {
    expect(MIN_RATINGS_FOR_SHARE).toBe(10);
    expect(positiveShare({ likes: 5, loves: 4, dislikes: 0 })).toBeNull();
    expect(positiveShare({ likes: 5, loves: 4, dislikes: 1 })).toBe(90);
  });
  it('counts every kind of rating in the total', () => {
    expect(totalRatings({ likes: 1, loves: 2, dislikes: 3 })).toBe(6);
  });
});
