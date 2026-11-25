import type { Rect, Size } from './annotate';
import type { Profile } from './profiles';

/** Pixels at the top and bottom of the frame that a burned in caption can cover. */
export interface Band {
  top: number;
  bottom: number;
}

const LINES = 2;
const PADDING = 20;

/** Two lines of caption, the box padding and the margin from the edge. Top uses a small fixed margin. */
export function captionBand(p: Profile): Band {
  const height = Math.round(p.captionFontSize * 1.25 * LINES + PADDING);
  return { top: height + 24, bottom: height + p.captionMarginV };
}

/** The lowest y a target may reach and still be clear of a bottom caption. */
export function reachableBottom(view: Size, band: Band): number {
  return view.height - band.bottom;
}

/** Bottom is the default. A target that would sit under the bottom caption moves the caption to the top. */
export function captionPlacement(target: Rect, view: Size, band: Band): 'top' | 'bottom' {
  const underBottom = target.y + target.height > reachableBottom(view, band);
  const underTop = target.y < band.top;
  return underBottom && !underTop ? 'top' : 'bottom';
}
