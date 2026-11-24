import { deriveSponsorStatus } from '@ad/shared';

export { deriveSponsorStatus };
export type { SponsorEffectiveStatus, SponsorSchedule } from '@ad/shared';

/** Lagos has no daylight saving, so it is always UTC+1 (same constant as @ad/analytics). */
const LAGOS_OFFSET_MS = 3_600_000;
const DAY_MS = 86_400_000;

function parseDay(day: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error(`Invalid day: ${day}`);
  const ms = Date.parse(`${day}T00:00:00Z`);
  if (Number.isNaN(ms) || new Date(ms).toISOString().slice(0, 10) !== day) {
    throw new Error(`Invalid day: ${day}`);
  }
  return ms;
}

/** The instant a Lagos calendar day starts, for the start of a schedule. */
export function lagosDayStart(day: string): Date {
  return new Date(parseDay(day) - LAGOS_OFFSET_MS);
}

/** The last second of a Lagos calendar day, so an end date is inclusive to 23:59:59. */
export function lagosDayEnd(day: string): Date {
  return new Date(parseDay(day) - LAGOS_OFFSET_MS + DAY_MS - 1000);
}

/** Whole days since 1970 in Lagos time. Changes at Lagos midnight. Used for caps and rotation. */
export function lagosDayNumber(instant: Date): number {
  return Math.floor((instant.getTime() + LAGOS_OFFSET_MS) / DAY_MS);
}
