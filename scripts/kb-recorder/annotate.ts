/** Geometry for numbered step annotations on screenshots. Pure so it can be tested without a browser. */

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}
export interface Point {
  x: number;
  y: number;
}
export interface Size {
  width: number;
  height: number;
}

const EDGE = 4;

/** Top left corner of a round badge that sits on the target's top left corner and stays inside the viewport. */
export function placeBadge(target: Rect, view: Size, size: number): Point {
  const clamp = (v: number, max: number) =>
    Math.min(Math.max(v, EDGE), Math.max(EDGE, max - size - EDGE));
  return { x: clamp(target.x - size / 2, view.width), y: clamp(target.y - size / 2, view.height) };
}

/** Arrow from the badge to the middle of the nearest side of the target, or null when they already touch. */
export function arrowFor(
  badge: Point,
  target: Rect,
  size: number,
): { from: Point; to: Point } | null {
  const c = { x: badge.x + size / 2, y: badge.y + size / 2 };
  const nearest = {
    x: Math.min(Math.max(c.x, target.x), target.x + target.width),
    y: Math.min(Math.max(c.y, target.y), target.y + target.height),
  };
  if (Math.hypot(c.x - nearest.x, c.y - nearest.y) <= size / 2 + 8) return null;
  const sides: Point[] = [
    { x: target.x, y: target.y + target.height / 2 },
    { x: target.x + target.width, y: target.y + target.height / 2 },
    { x: target.x + target.width / 2, y: target.y },
    { x: target.x + target.width / 2, y: target.y + target.height },
  ];
  const to = sides.reduce((best, p) =>
    Math.hypot(c.x - p.x, c.y - p.y) < Math.hypot(c.x - best.x, c.y - best.y) ? p : best,
  );
  const d = Math.hypot(to.x - c.x, to.y - c.y) || 1;
  return {
    from: { x: c.x + ((to.x - c.x) / d) * (size / 2), y: c.y + ((to.y - c.y) / d) * (size / 2) },
    to,
  };
}
