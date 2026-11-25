import { describe, expect, it } from 'vitest';
import { arrowFor, placeBadge } from './annotate';

const VIEW = { width: 1280, height: 720 };

describe('placeBadge', () => {
  it('puts the numbered badge on the top left corner of the target, outside the box', () => {
    expect(placeBadge({ x: 400, y: 300, width: 200, height: 40 }, VIEW, 28)).toEqual({
      x: 386,
      y: 286,
    });
  });
  it('keeps the badge fully inside the viewport near the edges', () => {
    expect(placeBadge({ x: 2, y: 3, width: 200, height: 40 }, VIEW, 28)).toEqual({ x: 4, y: 4 });
    expect(placeBadge({ x: 1270, y: 715, width: 50, height: 40 }, VIEW, 28)).toEqual({
      x: 1248,
      y: 688,
    });
  });
});

describe('arrowFor', () => {
  it('points from the badge to the nearest edge of the target', () => {
    const a = arrowFor({ x: 200, y: 300 }, { x: 400, y: 300, width: 200, height: 40 }, 28);
    expect(a!.to.x).toBe(400);
    expect(a!.to.y).toBe(320);
    expect(a!.from.x).toBeGreaterThan(200);
  });
  it('returns no arrow when the badge already touches the target', () => {
    expect(arrowFor({ x: 386, y: 286 }, { x: 400, y: 300, width: 200, height: 40 }, 28)).toBeNull();
  });
});
