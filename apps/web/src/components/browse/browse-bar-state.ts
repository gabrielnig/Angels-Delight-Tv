/** Smallest scroll move, in pixels, that changes the phone bar. Stops a jittery thumb from flickering it. */
export const SCROLL_DELTA = 8;

export interface BarInput {
  hidden: boolean;
  y: number;
  lastY: number;
  /** The rail is pinned under the nav, so the bar has something to hide under. */
  stuck: boolean;
  /** A menu is open or focus is inside the bar. */
  locked: boolean;
}

/** Headroom rule: hide on scroll down, return on scroll up, never while locked or before the stack sticks. */
export function nextBarHidden({ hidden, y, lastY, stuck, locked }: BarInput): boolean {
  if (locked || !stuck) return false;
  const dy = y - lastY;
  if (Math.abs(dy) < SCROLL_DELTA) return hidden;
  return dy > 0;
}
