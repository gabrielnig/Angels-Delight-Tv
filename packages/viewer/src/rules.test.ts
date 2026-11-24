import { describe, expect, it } from 'vitest';
import { DEFAULT_RULES } from './rules';

describe('home rules (M41)', () => {
  it('defaults match the plan', () => {
    expect(DEFAULT_RULES).toMatchObject({
      heroFallbackCount: 5,
      popularMinItems: 4,
      trendingWindowDays: 7,
      autoCategoryMinItems: 4,
      autoCategoryMax: 6,
      allSeriesMinItems: 2,
    });
  });
});
