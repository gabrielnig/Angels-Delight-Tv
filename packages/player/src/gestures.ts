export type Zone = 'left' | 'center' | 'right';

export function zoneFor(x: number, width: number): Zone {
  if (width <= 0) return 'center';
  const f = x / width;
  if (f < 1 / 3) return 'left';
  if (f > 2 / 3) return 'right';
  return 'center';
}

export type TapResult =
  | { kind: 'tap' }
  | { kind: 'toggle-play' }
  | { kind: 'seek'; seconds: number; total: number; side: 'left' | 'right' };

export interface TapTrackerOptions {
  /** Two taps closer than this are a double tap. */
  doubleTapMs?: number;
  /** Further taps within this window keep adding to the total. */
  accumulateMs?: number;
  seekSeconds?: number;
}

/** M08-S04 double tap seek: right third forward, left third back, centre toggles play, taps accumulate. */
export class TapTracker {
  private lastAt = -Infinity;
  private lastZone: Zone | null = null;
  private seekSide: 'left' | 'right' | null = null;
  private seekTotal = 0;
  private seekAt = -Infinity;
  private readonly doubleMs: number;
  private readonly accumulateMs: number;
  private readonly step: number;

  constructor(opts: TapTrackerOptions = {}) {
    this.doubleMs = opts.doubleTapMs ?? 300;
    this.accumulateMs = opts.accumulateMs ?? 700;
    this.step = opts.seekSeconds ?? 10;
  }

  tap(x: number, width: number, now: number): TapResult {
    const zone = zoneFor(x, width);
    const gap = this.lastZone === zone ? now - this.lastAt : Infinity;
    const chaining = this.seekSide !== null && now - this.seekAt <= this.accumulateMs;
    this.lastAt = now;
    this.lastZone = zone;

    if (zone === 'center') {
      this.seekSide = null;
      return gap <= this.doubleMs ? { kind: 'toggle-play' } : { kind: 'tap' };
    }
    const isDouble = gap <= this.doubleMs || (chaining && this.seekSide === zone);
    if (!isDouble) {
      this.seekSide = null;
      return { kind: 'tap' };
    }
    if (this.seekSide !== zone || !chaining) this.seekTotal = 0;
    this.seekSide = zone;
    this.seekAt = now;
    const seconds = zone === 'right' ? this.step : -this.step;
    this.seekTotal += seconds;
    return { kind: 'seek', seconds, total: this.seekTotal, side: zone };
  }
}
