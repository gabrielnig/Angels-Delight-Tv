import type { SponsorEffectiveStatus, SponsorSlot } from '@ad/shared';
import type { BadgeTone } from './Badge';

export const SLOT_LABELS: Record<SponsorSlot, string> = {
  home_banner: 'Home page banner',
  title_card: 'Video page card',
  player_after: 'After the video',
  player_before: 'Before the video',
};

export const SPONSOR_STATUS_LABELS: Record<SponsorEffectiveStatus, { label: string; tone: BadgeTone }> = {
  draft: { label: 'Draft', tone: 'neutral' },
  scheduled: { label: 'Scheduled', tone: 'info' },
  live: { label: 'Live', tone: 'success' },
  paused: { label: 'Paused', tone: 'warning' },
  ended: { label: 'Ended', tone: 'neutral' },
  archived: { label: 'Archived', tone: 'neutral' },
};

const fmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Lagos', day: 'numeric', month: 'short', year: 'numeric' });
const iso = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos' });

export const lagosDayLabel = (d: Date | null): string => (d ? fmt.format(d) : 'Not set');
/** YYYY-MM-DD for a date input, in Lagos time. */
export const lagosDayInput = (d: Date | null): string => (d ? iso.format(d) : '');

const dayFmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' });
/** A Lagos day string (YYYY-MM-DD) as `1 Jan 2027`. */
export const dayLabel = (day: string): string => dayFmt.format(new Date(`${day}T00:00:00Z`));
