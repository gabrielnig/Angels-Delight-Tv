import { describe, expect, it } from 'vitest';
import { bucketLabel, percentileFromBuckets, STARTUP_EDGES_MS, vitalEdges } from './histogram';

describe('bucketLabel', () => {
  it('puts a value in the first bucket whose upper edge it does not exceed', () => {
    expect(bucketLabel(STARTUP_EDGES_MS, 0)).toBe('le500');
    expect(bucketLabel(STARTUP_EDGES_MS, 500)).toBe('le500');
    expect(bucketLabel(STARTUP_EDGES_MS, 501)).toBe('le1000');
  });
  it('uses an overflow bucket past the last edge', () => {
    expect(bucketLabel(STARTUP_EDGES_MS, 999_999)).toBe('gt20000');
  });
});

describe('percentileFromBuckets', () => {
  const counts = { le500: 10, le1000: 30, le2000: 40, gt20000: 20 };
  it('returns the upper edge of the bucket holding the percentile', () => {
    expect(percentileFromBuckets(counts, 0.5)).toBe(2000);
    expect(percentileFromBuckets(counts, 0.1)).toBe(500);
    expect(percentileFromBuckets(counts, 0.75)).toBe(2000);
  });
  it('returns null when there is no data and Infinity for the overflow bucket', () => {
    expect(percentileFromBuckets({}, 0.5)).toBeNull();
    expect(percentileFromBuckets(counts, 0.99)).toBe(Number.POSITIVE_INFINITY);
  });
});

describe('vitalEdges', () => {
  it('has edges for every vital', () => {
    for (const name of ['LCP', 'INP', 'CLS', 'FCP', 'TTFB'] as const) {
      expect(vitalEdges(name).length).toBeGreaterThan(3);
    }
  });
});
