import { SPONSOR_SLOTS, type SponsorSlot } from '@ad/shared';

export const REPORT_MAX_DAYS = 400;

export interface StatRow {
  /** A Lagos day, YYYY-MM-DD. */
  day: string;
  creativeId: string;
  slot: SponsorSlot;
  impressions: number;
  clicks: number;
  /** Distinct viewers that day for this creative and placement. A daily figure only. */
  reach: number;
}

export interface ReportInput {
  fromDay: string;
  toDay: string;
  rows: StatRow[];
  /** Creative id to headline. A creative that was removed keeps its numbers under a placeholder. */
  creativeNames: ReadonlyMap<string, string>;
}

export interface DayLine {
  day: string;
  impressions: number;
  clicks: number;
  clickRate: number;
  dailyReach: number;
}
export interface CreativeLine {
  creativeId: string;
  headline: string;
  impressions: number;
  clicks: number;
  clickRate: number;
}
export interface SlotLine {
  slot: SponsorSlot;
  impressions: number;
  clicks: number;
  clickRate: number;
}
export interface Report {
  fromDay: string;
  toDay: string;
  days: DayLine[];
  totals: { impressions: number; clicks: number; clickRate: number; peakDailyReach: number };
  byCreative: CreativeLine[];
  bySlot: SlotLine[];
  reachNote: string;
}

export const REACH_NOTE =
  'Reach is a daily figure: the viewers counted on one day. Daily figures are not added up, because the same person on two days would count twice.';

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const MS_PER_DAY = 86_400_000;

function parseDay(day: string): number | null {
  if (!DAY.test(day)) return null;
  const t = Date.parse(`${day}T00:00:00Z`);
  if (Number.isNaN(t)) return null;
  return new Date(t).toISOString().slice(0, 10) === day ? t : null;
}

export function checkRange(fromDay: string, toDay: string): { ok: true } | { ok: false; error: string } {
  const from = parseDay(fromDay);
  const to = parseDay(toDay);
  if (from === null || to === null) return { ok: false, error: 'Choose a start and an end date.' };
  if (to < from) return { ok: false, error: 'The end date is before the start date.' };
  if ((to - from) / MS_PER_DAY + 1 > REPORT_MAX_DAYS) {
    return { ok: false, error: `Choose a range of ${REPORT_MAX_DAYS} days or fewer.` };
  }
  return { ok: true };
}

const LAGOS_OFFSET_MS = 3_600_000;

/** The last 30 Lagos days, ending today. */
export function defaultRange(now: Date): { fromDay: string; toDay: string } {
  const today = new Date(now.getTime() + LAGOS_OFFSET_MS);
  const to = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return {
    fromDay: new Date(to - 29 * MS_PER_DAY).toISOString().slice(0, 10),
    toDay: new Date(to).toISOString().slice(0, 10),
  };
}

/** Reads `from` and `to` from a query. Anything missing, malformed or too long gives the default range. */
export function parseReportRange(
  params: Record<string, string | string[] | undefined>,
  now: Date,
): { fromDay: string; toDay: string } {
  const from = params.from;
  const to = params.to;
  if (typeof from === 'string' && typeof to === 'string' && checkRange(from, to).ok) {
    return { fromDay: from, toDay: to };
  }
  return defaultRange(now);
}

const rate = (clicks: number, impressions: number) => (impressions > 0 ? clicks / impressions : 0);

export function buildReport(input: ReportInput): Report {
  const checked = checkRange(input.fromDay, input.toDay);
  if (!checked.ok) throw new RangeError(checked.error);
  const from = parseDay(input.fromDay)!;
  const to = parseDay(input.toDay)!;

  const dayMap = new Map<string, { impressions: number; clicks: number; reach: number }>();
  for (let t = from; t <= to; t += MS_PER_DAY) {
    dayMap.set(new Date(t).toISOString().slice(0, 10), { impressions: 0, clicks: 0, reach: 0 });
  }
  const creatives = new Map<string, { impressions: number; clicks: number }>();
  const slots = new Map<SponsorSlot, { impressions: number; clicks: number }>(
    SPONSOR_SLOTS.map((s) => [s, { impressions: 0, clicks: 0 }]),
  );

  for (const r of input.rows) {
    const d = dayMap.get(r.day);
    if (!d) continue;
    d.impressions += r.impressions;
    d.clicks += r.clicks;
    d.reach += r.reach;
    const c = creatives.get(r.creativeId) ?? { impressions: 0, clicks: 0 };
    c.impressions += r.impressions;
    c.clicks += r.clicks;
    creatives.set(r.creativeId, c);
    const s = slots.get(r.slot);
    if (s) {
      s.impressions += r.impressions;
      s.clicks += r.clicks;
    }
  }

  const days: DayLine[] = [...dayMap].map(([day, v]) => ({
    day,
    impressions: v.impressions,
    clicks: v.clicks,
    clickRate: rate(v.clicks, v.impressions),
    dailyReach: v.reach,
  }));
  const impressions = days.reduce((n, d) => n + d.impressions, 0);
  const clicks = days.reduce((n, d) => n + d.clicks, 0);
  return {
    fromDay: input.fromDay,
    toDay: input.toDay,
    days,
    totals: {
      impressions,
      clicks,
      clickRate: rate(clicks, impressions),
      peakDailyReach: days.reduce((m, d) => Math.max(m, d.dailyReach), 0),
    },
    byCreative: [...creatives]
      .map(([creativeId, v]) => ({
        creativeId,
        headline: input.creativeNames.get(creativeId) ?? 'Removed creative',
        impressions: v.impressions,
        clicks: v.clicks,
        clickRate: rate(v.clicks, v.impressions),
      }))
      .sort((a, b) => b.impressions - a.impressions || a.creativeId.localeCompare(b.creativeId)),
    bySlot: [...slots].map(([slot, v]) => ({ slot, ...v, clickRate: rate(v.clicks, v.impressions) })),
    reachNote: REACH_NOTE,
  };
}
