/** Skip windows for one video, in seconds (M43). `end: null` on credits means "to the end of the video". */
export type MarkerKind = 'intro' | 'recap' | 'credits';

export interface MarkerWindow {
  start: number;
  end: number | null;
}

export type PlayerMarkers = Partial<Record<MarkerKind, MarkerWindow>>;

export interface ActiveMarker {
  kind: MarkerKind;
  /** Where Skip seeks to: the window end, or the video end for credits without an end. */
  skipTo: number;
  /** Credits with a next title: the button says "Next lesson" and plays the next title. */
  nextLesson: boolean;
}

export const MIN_WINDOW_SECONDS = 3;

/** Credits first: when windows touch, the end of the lesson matters more than a recap. */
const PRIORITY: readonly MarkerKind[] = ['credits', 'intro', 'recap'];

function known(duration: number): boolean {
  return Number.isFinite(duration) && duration > 0;
}

function resolveEnd(window: MarkerWindow, duration: number): number | null {
  if (window.end !== null) return known(duration) ? Math.min(window.end, duration) : window.end;
  return known(duration) ? duration : null;
}

function usable(window: MarkerWindow | undefined, duration: number): window is MarkerWindow {
  if (!window || !Number.isFinite(window.start) || window.start < 0) return false;
  if (window.end !== null && !(window.end > window.start)) return false;
  if (known(duration) && window.start >= duration) return false;
  const end = resolveEnd(window, duration);
  if (end === null) return false;
  return end - window.start >= MIN_WINDOW_SECONDS;
}

/** Drops unusable windows and clamps ends to the duration once it is known. */
export function normalizeMarkers(
  input: PlayerMarkers | undefined,
  duration: number,
): PlayerMarkers {
  const out: PlayerMarkers = {};
  for (const kind of PRIORITY) {
    const window = input?.[kind];
    if (!usable(window, duration)) continue;
    out[kind] = {
      start: window.start,
      end: window.end === null ? null : resolveEnd(window, duration),
    };
  }
  return out;
}

/** The marker the viewer can skip at `time`, or null. Pure, so the controller calls it on every tick. */
export function activeMarker(
  markers: PlayerMarkers | undefined,
  time: number,
  duration: number,
  hasNext: boolean,
): ActiveMarker | null {
  if (!markers) return null;
  for (const kind of PRIORITY) {
    const window = markers[kind];
    if (!usable(window, duration)) continue;
    const end = resolveEnd(window, duration);
    if (end === null) continue;
    if (time >= window.start && time < end) {
      return { kind, skipTo: end, nextLesson: kind === 'credits' && hasNext };
    }
  }
  return null;
}
