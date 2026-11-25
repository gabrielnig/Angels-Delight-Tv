import { describe, expect, it } from 'vitest';
import { DURATION_BUCKETS, bucketOfMs } from './titles';

describe('duration buckets match their labels (L11)', () => {
  it('are Under 5 min, 5 to 15 min and Over 15 min, in milliseconds', () => {
    expect(DURATION_BUCKETS).toEqual({
      short: [0, 300_000],
      medium: [300_000, 900_000],
      long: [900_000, null],
    });
  });

  it('puts the edges on the side the label says: 5:00 is in 5 to 15, 15:00 is in Over 15', () => {
    expect(bucketOfMs(0)).toBe('short');
    expect(bucketOfMs(299_999)).toBe('short');
    expect(bucketOfMs(300_000)).toBe('medium');
    expect(bucketOfMs(899_999)).toBe('medium');
    expect(bucketOfMs(900_000)).toBe('long');
    expect(bucketOfMs(7_200_000)).toBe('long');
  });
});
