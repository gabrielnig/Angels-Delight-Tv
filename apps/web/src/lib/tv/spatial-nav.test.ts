import { describe, expect, it } from 'vitest';
import { nextFocus, type FocusRect } from './spatial-nav';

const r = (id: string, left: number, top: number, w = 100, h = 100): FocusRect => ({
  id,
  left,
  top,
  right: left + w,
  bottom: top + h,
});

// A 3 x 2 grid of tiles, 100 wide, 20 apart.
const grid = [
  r('a', 0, 0),
  r('b', 120, 0),
  r('c', 240, 0),
  r('d', 0, 120),
  r('e', 120, 120),
  r('f', 240, 120),
];

describe('nextFocus', () => {
  it('moves right and left along a row', () => {
    expect(nextFocus(grid, 'a', 'right')).toBe('b');
    expect(nextFocus(grid, 'b', 'right')).toBe('c');
    expect(nextFocus(grid, 'c', 'left')).toBe('b');
  });

  it('moves down and up between rows', () => {
    expect(nextFocus(grid, 'b', 'down')).toBe('e');
    expect(nextFocus(grid, 'f', 'up')).toBe('c');
  });

  it('returns null at an edge', () => {
    expect(nextFocus(grid, 'a', 'left')).toBeNull();
    expect(nextFocus(grid, 'a', 'up')).toBeNull();
    expect(nextFocus(grid, 'c', 'right')).toBeNull();
    expect(nextFocus(grid, 'f', 'down')).toBeNull();
  });

  it('prefers the tile that overlaps across the axis over a nearer diagonal one', () => {
    const rects = [r('from', 0, 0), r('diag', 110, 150, 100, 100), r('below', 0, 300)];
    expect(nextFocus(rects, 'from', 'down')).toBe('below');
  });

  it('prefers the nearest facing gap among overlapping candidates', () => {
    const rects = [r('from', 0, 0), r('far', 0, 400), r('near', 0, 150)];
    expect(nextFocus(rects, 'from', 'down')).toBe('near');
  });

  it('breaks ties by the larger overlap', () => {
    const rects = [
      r('from', 0, 0, 100, 100),
      r('small', 80, 150, 100, 100),
      r('big', 10, 150, 100, 100),
    ];
    expect(nextFocus(rects, 'from', 'down')).toBe('big');
  });

  it('falls back to a non overlapping candidate when nothing overlaps', () => {
    const rects = [r('from', 0, 0), r('side', 300, 150)];
    expect(nextFocus(rects, 'from', 'down')).toBe('side');
  });

  it('ignores candidates behind the current element', () => {
    const rects = [r('from', 0, 200), r('above', 0, 0)];
    expect(nextFocus(rects, 'from', 'down')).toBeNull();
  });

  it('returns null for an unknown current id', () => {
    expect(nextFocus(grid, 'zzz', 'right')).toBeNull();
  });

  it('works for a lone element', () => {
    expect(nextFocus([r('only', 0, 0)], 'only', 'right')).toBeNull();
  });
});
