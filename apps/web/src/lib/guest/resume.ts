import { formatClock } from '@ad/ui';
import type { PrimaryAction } from '../title-cta';
import type { GuestProgressEntry } from './progress-store';

/** Under this many seconds counts as not started. */
export const GUEST_RESUME_MIN_SECONDS = 5;

/** The main button of a title page for a guest, from the place saved on this device (M40). */
export function guestPrimary(
  input: { watchHref: string; durationSeconds: number },
  entry: GuestProgressEntry | null,
): PrimaryAction {
  const fromStart = `${input.watchHref}?t=0`;
  if (entry?.f) return { text: 'Watch again', href: fromStart };
  if (entry && entry.p >= GUEST_RESUME_MIN_SECONDS) {
    return {
      text: `Resume from ${formatClock(entry.p)}`,
      href: input.watchHref,
      startOverHref: fromStart,
    };
  }
  return { text: 'Play', href: input.watchHref };
}
