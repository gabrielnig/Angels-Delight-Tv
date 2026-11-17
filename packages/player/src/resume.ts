export const RESUME_MIN_SECONDS = 5;
export const RESUME_REWIND_SECONDS = 3;

export interface ResumeInput {
  /** Value of the ?t= query parameter, if any. Overrides the saved position for this load. */
  urlT?: number | null;
  /** Saved position in seconds for this profile and video. */
  saved?: number | null;
  /** Known duration in seconds. Used to discard stale positions after a video was replaced. */
  duration?: number | null;
  /** True when the saved row is marked finished: start over. */
  finished?: boolean;
  rewind?: number;
  minSaved?: number;
}

export interface ResumeResult {
  start: number;
  source: 'url' | 'saved' | 'none';
  /** Saved position to show in the "Resumed from 2:14" toast, null when no toast applies. */
  resumedFrom: number | null;
}

const NONE: ResumeResult = { start: 0, source: 'none', resumedFrom: null };

function inRange(
  value: number | null | undefined,
  duration: number | null | undefined,
): value is number {
  if (value === null || value === undefined || !Number.isFinite(value) || value < 0) return false;
  if (
    duration !== null &&
    duration !== undefined &&
    Number.isFinite(duration) &&
    duration > 0 &&
    value >= duration
  )
    return false;
  return true;
}

/** M08-S15: saved position minus 3 seconds, ?t overrides, stale or short positions are ignored. */
export function computeStartPosition(input: ResumeInput): ResumeResult {
  const { urlT, saved, duration, finished = false } = input;
  const rewind = input.rewind ?? RESUME_REWIND_SECONDS;
  const minSaved = input.minSaved ?? RESUME_MIN_SECONDS;

  if (inRange(urlT, duration)) {
    return { start: Math.floor(urlT), source: 'url', resumedFrom: null };
  }
  if (finished) return NONE;
  if (inRange(saved, duration) && saved >= minSaved) {
    return {
      start: Math.max(0, Math.floor(saved) - rewind),
      source: 'saved',
      resumedFrom: Math.floor(saved),
    };
  }
  return NONE;
}
