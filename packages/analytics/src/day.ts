/** Analytics days are Africa/Lagos calendar days. Lagos has no daylight saving, so the offset is a constant UTC+1. */
export const LAGOS_OFFSET_HOURS = 1;
export const ANALYTICS_TIME_ZONE = 'Africa/Lagos';
const DAY_MS = 86_400_000;

export interface DayRange {
  from: string;
  to: string;
}

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function parseDay(day: string): number {
  if (!DAY_PATTERN.test(day)) throw new Error(`Invalid day: ${day}`);
  const ms = Date.parse(`${day}T00:00:00Z`);
  if (Number.isNaN(ms) || new Date(ms).toISOString().slice(0, 10) !== day) {
    throw new Error(`Invalid day: ${day}`);
  }
  return ms;
}

export function lagosDay(instant: Date): string {
  return new Date(instant.getTime() + LAGOS_OFFSET_HOURS * 3_600_000).toISOString().slice(0, 10);
}

/** UTC instants that bound a Lagos day: start inclusive, end exclusive. */
export function dayBounds(day: string): { start: Date; end: Date } {
  const startMs = parseDay(day) - LAGOS_OFFSET_HOURS * 3_600_000;
  return { start: new Date(startMs), end: new Date(startMs + DAY_MS) };
}

export function addDays(day: string, delta: number): string {
  return new Date(parseDay(day) + delta * DAY_MS).toISOString().slice(0, 10);
}

/** Number of days in an inclusive range. */
export function daysBetween(from: string, to: string): number {
  return Math.round((parseDay(to) - parseDay(from)) / DAY_MS) + 1;
}

export function previousPeriod(range: DayRange): DayRange {
  const length = daysBetween(range.from, range.to);
  return { from: addDays(range.from, -length), to: addDays(range.from, -1) };
}
