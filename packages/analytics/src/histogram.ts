import type { VITAL_NAMES } from './events';

/** Fixed bucket edges so counters stay small and percentiles can be rebuilt later. */
export const STARTUP_EDGES_MS = [500, 1000, 1500, 2000, 3000, 4000, 6000, 8000, 12_000, 20_000];

const VITAL_EDGES: Record<(typeof VITAL_NAMES)[number], number[]> = {
  LCP: [1000, 1500, 2000, 2500, 3000, 4000, 6000, 10_000],
  FCP: [800, 1200, 1800, 2500, 3000, 4000, 6000],
  TTFB: [200, 400, 800, 1200, 1800, 3000, 6000],
  INP: [100, 200, 300, 500, 800, 1500],
  CLS: [0.05, 0.1, 0.15, 0.25, 0.4, 0.8],
};

export function vitalEdges(name: (typeof VITAL_NAMES)[number]): number[] {
  return VITAL_EDGES[name];
}

export function bucketLabel(edges: number[], value: number): string {
  const edge = edges.find((candidate) => value <= candidate);
  return edge === undefined ? `gt${edges.at(-1)}` : `le${edge}`;
}

function edgeOf(label: string): number {
  return label.startsWith('gt') ? Number.POSITIVE_INFINITY : Number(label.slice(2));
}

/** Upper edge of the bucket that holds the given percentile (0 to 1), or null with no data. */
export function percentileFromBuckets(
  counts: Record<string, number>,
  percentile: number,
): number | null {
  const entries = Object.entries(counts)
    .filter(([, count]) => count > 0)
    .sort(([a], [b]) => edgeOf(a) - edgeOf(b));
  const total = entries.reduce((sum, [, count]) => sum + count, 0);
  if (total === 0) return null;
  let seen = 0;
  for (const [label, count] of entries) {
    seen += count;
    if (seen / total >= percentile) return edgeOf(label);
  }
  return null;
}
