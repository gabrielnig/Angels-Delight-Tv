/** Sponsor vocabulary shared by the database schema, the selection code and tests (M48). */

export const SPONSOR_SLOTS = ['home_banner', 'title_card', 'player_after', 'player_before'] as const;
export type SponsorSlot = (typeof SPONSOR_SLOTS)[number];

/** Stored statuses. Scheduled, live and ended are derived from the dates at read time (D-256). */
export const SPONSOR_STATUSES = ['draft', 'active', 'paused', 'archived'] as const;
export type SponsorStoredStatus = (typeof SPONSOR_STATUSES)[number];

export const SPONSOR_EFFECTIVE_STATUSES = [
  'draft',
  'scheduled',
  'live',
  'paused',
  'ended',
  'archived',
] as const;
export type SponsorEffectiveStatus = (typeof SPONSOR_EFFECTIVE_STATUSES)[number];

export const isSponsorSlot = (value: unknown): value is SponsorSlot =>
  typeof value === 'string' && (SPONSOR_SLOTS as readonly string[]).includes(value);

export interface SponsorSchedule {
  status: SponsorStoredStatus;
  startsAt: Date | null;
  endsAt: Date | null;
}

/**
 * Same rule as the SQL function sponsor_effective(). The window is inclusive at both ends. Dates are stored as
 * instants: the admin form turns a Lagos day into 00:00:00 and 23:59:59 Lagos time before saving.
 */
export function deriveSponsorStatus(sponsor: SponsorSchedule, at: Date): SponsorEffectiveStatus {
  if (sponsor.status === 'draft') return 'draft';
  if (sponsor.status === 'paused') return 'paused';
  if (sponsor.status === 'archived') return 'archived';
  if (sponsor.startsAt && at.getTime() < sponsor.startsAt.getTime()) return 'scheduled';
  if (sponsor.endsAt && at.getTime() > sponsor.endsAt.getTime()) return 'ended';
  return 'live';
}

export interface SponsorStatusFixture {
  name: string;
  sponsor: SponsorSchedule;
  at: Date;
  expected: SponsorEffectiveStatus;
}

const start = new Date('2026-12-01T00:00:00Z');
const end = new Date('2026-12-31T22:59:59Z');

/** Shared by the TypeScript test and the database test, so the two derivations cannot drift apart. */
export const SPONSOR_STATUS_FIXTURES: SponsorStatusFixture[] = [
  { name: 'draft', sponsor: { status: 'draft', startsAt: start, endsAt: end }, at: new Date('2026-12-15T12:00:00Z'), expected: 'draft' },
  { name: 'scheduled', sponsor: { status: 'active', startsAt: start, endsAt: end }, at: new Date('2026-11-30T12:00:00Z'), expected: 'scheduled' },
  { name: 'live', sponsor: { status: 'active', startsAt: start, endsAt: end }, at: new Date('2026-12-15T12:00:00Z'), expected: 'live' },
  { name: 'live without dates', sponsor: { status: 'active', startsAt: null, endsAt: null }, at: new Date('2026-12-15T12:00:00Z'), expected: 'live' },
  { name: 'live on the last second', sponsor: { status: 'active', startsAt: start, endsAt: end }, at: end, expected: 'live' },
  { name: 'ended', sponsor: { status: 'active', startsAt: start, endsAt: end }, at: new Date('2027-01-02T00:00:00Z'), expected: 'ended' },
  { name: 'paused', sponsor: { status: 'paused', startsAt: start, endsAt: end }, at: new Date('2026-12-15T12:00:00Z'), expected: 'paused' },
  { name: 'archived', sponsor: { status: 'archived', startsAt: null, endsAt: null }, at: new Date('2026-12-15T12:00:00Z'), expected: 'archived' },
];
