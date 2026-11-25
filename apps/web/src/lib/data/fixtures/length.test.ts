import { describe, expect, it } from 'vitest';
import { DURATION_BUCKETS, bucketOfMs } from '@ad/catalog';
import { matchesLength } from './queries';

describe('fixture length filter follows the service buckets (L11)', () => {
  it('agrees with the catalog service at every edge', () => {
    for (const seconds of [0, 59, 179, 180, 299, 300, 301, 600, 899, 900, 901, 3600]) {
      const bucket = bucketOfMs(seconds * 1000);
      for (const length of ['short', 'medium', 'long'] as const) {
        expect(matchesLength(seconds, length), `${seconds}s in ${length}`).toBe(bucket === length);
      }
      expect(matchesLength(seconds, 'any')).toBe(true);
    }
  });

  it('keeps the bucket keys the service has', () => {
    expect(Object.keys(DURATION_BUCKETS)).toEqual(['short', 'medium', 'long']);
  });
});
