/**
 * Spatial navigation for TV remotes (M49-S15). Arrow keys move focus to the nearest element in that direction.
 * `nextFocus` is pure so it can be tested without a layout engine.
 */
export type Direction = 'up' | 'down' | 'left' | 'right';

export type FocusRect = {
  id: string;
  left: number;
  top: number;
  right: number;
  bottom: number;
};

type Score = { overlap: number; gap: number; offset: number };

function overlapOf(a0: number, a1: number, b0: number, b1: number): number {
  return Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));
}

function score(from: FocusRect, to: FocusRect, dir: Direction): Score | null {
  const horizontal = dir === 'left' || dir === 'right';
  // Gap along the pressed axis. Negative means the candidate is behind or on top of the current element.
  let gap: number;
  if (dir === 'right') gap = to.left - from.right;
  else if (dir === 'left') gap = from.left - to.right;
  else if (dir === 'down') gap = to.top - from.bottom;
  else gap = from.top - to.bottom;
  // A candidate must start beyond the current element's leading edge.
  const lead =
    dir === 'right'
      ? to.left >= from.right - 1 || to.left > from.left
      : dir === 'left'
        ? to.right <= from.left + 1 || to.right < from.right
        : dir === 'down'
          ? to.top >= from.bottom - 1 || to.top > from.top
          : to.bottom <= from.top + 1 || to.bottom < from.bottom;
  if (!lead || gap < -1) return null;

  const overlap = horizontal
    ? overlapOf(from.top, from.bottom, to.top, to.bottom)
    : overlapOf(from.left, from.right, to.left, to.right);
  const centreFrom = horizontal ? (from.top + from.bottom) / 2 : (from.left + from.right) / 2;
  const centreTo = horizontal ? (to.top + to.bottom) / 2 : (to.left + to.right) / 2;
  return { overlap, gap: Math.max(0, gap), offset: Math.abs(centreFrom - centreTo) };
}

/**
 * Pick the next element. Order: candidates that overlap across the axis first, then the smallest facing gap, then
 * the largest overlap, then the smallest cross offset. Returns null at an edge so the caller leaves the key alone.
 */
export function nextFocus(rects: FocusRect[], currentId: string, dir: Direction): string | null {
  const from = rects.find((x) => x.id === currentId);
  if (!from) return null;
  let best: { id: string; s: Score } | null = null;
  for (const to of rects) {
    if (to.id === currentId) continue;
    const s = score(from, to, dir);
    if (!s) continue;
    if (!best || better(s, best.s)) best = { id: to.id, s };
  }
  return best ? best.id : null;
}

function better(a: Score, b: Score): boolean {
  const aHit = a.overlap > 0;
  const bHit = b.overlap > 0;
  if (aHit !== bHit) return aHit;
  if (a.gap !== b.gap) return a.gap < b.gap;
  if (a.overlap !== b.overlap) return a.overlap > b.overlap;
  return a.offset < b.offset;
}
