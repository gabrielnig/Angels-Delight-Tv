import { arrowFor, placeBadge, type Point, type Rect, type Size } from './annotate';

export interface MarkInput {
  rect: Rect;
  /** `mark` (default) is a numbered highlight, `blur` hides the area. */
  kind?: 'mark' | 'blur';
  /** Draw an arrow from the badge to the target. Off by default: numbers and step text carry the meaning. */
  arrow?: boolean;
}

export interface Shapes {
  highlights: Rect[];
  badges: Array<Point & { n: number; size: number }>;
  arrows: Array<{ from: Point; to: Point }>;
  blurs: Rect[];
}

export const BADGE_SIZE = 28;
const BLUR_PAD = 6;

/** Geometry of the annotation layer: highlights and numbered badges, optional arrows, padded blurs. Pure. */
export function planShapes(marks: MarkInput[], view: Size, size = BADGE_SIZE): Shapes {
  const out: Shapes = { highlights: [], badges: [], arrows: [], blurs: [] };
  let n = 0;
  for (const m of marks) {
    if (m.kind === 'blur') {
      out.blurs.push({
        x: m.rect.x - BLUR_PAD,
        y: m.rect.y - BLUR_PAD,
        width: m.rect.width + BLUR_PAD * 2,
        height: m.rect.height + BLUR_PAD * 2,
      });
      continue;
    }
    n += 1;
    const badge = placeBadge(m.rect, view, size);
    out.highlights.push(m.rect);
    out.badges.push({ ...badge, n, size });
    if (m.arrow) {
      const arrow = arrowFor(badge, m.rect, size);
      if (arrow) out.arrows.push(arrow);
    }
  }
  return out;
}

/** A tight crop around one card: padded, clamped to the viewport and never smaller than the minimum. */
export function cropRect(
  target: Rect,
  view: Size,
  pad: number,
  min: { minWidth: number; minHeight: number } = { minWidth: 0, minHeight: 0 },
): Rect {
  let x = Math.max(0, target.x - pad);
  let y = Math.max(0, target.y - pad);
  let right = Math.min(view.width, target.x + target.width + pad);
  let bottom = Math.min(view.height, target.y + target.height + pad);
  const grow = (lo: number, hi: number, want: number, max: number): [number, number] => {
    const have = hi - lo;
    if (have >= want) return [lo, hi];
    const extra = want - have;
    let a = lo - extra / 2;
    let b = hi + extra / 2;
    if (a < 0) [a, b] = [0, Math.min(max, want)];
    if (b > max) [a, b] = [Math.max(0, max - want), max];
    return [a, b];
  };
  [x, right] = grow(x, right, min.minWidth, view.width);
  [y, bottom] = grow(y, bottom, min.minHeight, view.height);
  return { x, y, width: right - x, height: bottom - y };
}
