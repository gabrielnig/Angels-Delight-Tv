export interface SeriesPoint {
  label: string;
  value: number;
}

/** Round up to a tidy axis maximum (1, 2, 2.5, 5 times a power of ten). */
export function niceMax(max: number): number {
  if (max <= 0) return 1;
  const power = 10 ** Math.floor(Math.log10(max));
  for (const step of [1, 2, 2.5, 5, 10]) {
    if (max <= step * power) return step * power;
  }
  return 10 * power;
}

export function formatCompact(value: number): string {
  if (value >= 1_000_000) return `${+(value / 1_000_000).toFixed(1)}m`;
  if (value >= 1_000) return `${+(value / 1_000).toFixed(1)}k`;
  return String(Math.round(value));
}

/** Plain words summary so the chart has a text alternative. */
export function describeSeries(points: SeriesPoint[], noun: string): string {
  if (points.length === 0) return `No ${noun} to show.`;
  let high = points[0]!;
  let low = points[0]!;
  let total = 0;
  for (const point of points) {
    if (point.value > high.value) high = point;
    if (point.value < low.value) low = point;
    total += point.value;
  }
  const n = (v: number) => v.toLocaleString('en-NG');
  return `${points.length} points, ${n(total)} ${noun} in total. Highest: ${high.label} with ${n(high.value)}. Lowest: ${low.label} with ${n(low.value)}.`;
}

/** Positions for a chart inside a width by height box. */
export function layoutSeries(points: SeriesPoint[], width: number, height: number, max: number) {
  const step = points.length > 1 ? width / (points.length - 1) : 0;
  return points.map((point, index) => ({
    ...point,
    x: points.length > 1 ? index * step : width / 2,
    y: height - (point.value / max) * height,
  }));
}
