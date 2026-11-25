import { addDays, daysBetween, lagosDay, positiveShare, previousPeriod } from '@ad/analytics';
import type {
  DayRange,
  OverviewResult,
  PeriodTotals,
  RetentionPoint,
  ShareCount,
  SplitRow,
  TitleDailyRow,
  TopTitle,
} from '@ad/analytics';
import type { AdminStore } from './store';

export type RangePreset = '7d' | '28d' | '90d' | 'custom';
export const MAX_RANGE_DAYS = 366;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const PRESET_DAYS = { '7d': 7, '28d': 28, '90d': 90 } as const;

const valid = (day: string) =>
  DAY.test(day) && new Date(`${day}T00:00:00Z`).toISOString().slice(0, 10) === day;

/** Reads ?range=&from=&to=. Anything odd falls back to the last 28 days. */
export function parseRange(
  sp: Record<string, string | string[] | undefined>,
  now: Date = new Date(),
): { preset: RangePreset; range: DayRange } {
  const today = lagosDay(now);
  const last = (days: number): DayRange => ({ from: addDays(today, -(days - 1)), to: today });
  const key = typeof sp.range === 'string' ? sp.range : '28d';
  if (key === '7d' || key === '28d' || key === '90d')
    return { preset: key, range: last(PRESET_DAYS[key]) };
  if (
    key === 'custom' &&
    typeof sp.from === 'string' &&
    typeof sp.to === 'string' &&
    valid(sp.from) &&
    valid(sp.to) &&
    sp.from <= sp.to &&
    sp.to <= today &&
    daysBetween(sp.from, sp.to) <= MAX_RANGE_DAYS
  )
    return { preset: 'custom', range: { from: sp.from, to: sp.to } };
  return { preset: '28d', range: last(28) };
}

export function changeLabel(
  current: number,
  previous: number,
): { text: string; direction: 'up' | 'down' | 'flat' | 'none' } {
  if (previous <= 0) return { text: 'No data for the period before', direction: 'none' };
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct === 0) return { text: 'Same as the period before', direction: 'flat' };
  return {
    text: `${pct > 0 ? 'Up' : 'Down'} ${Math.abs(pct)}% from the period before`,
    direction: pct > 0 ? 'up' : 'down',
  };
}

export function formatWatchTime(ms: number): string {
  const minutes = Math.round(ms / 60_000);
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const short = (day: string) => `${Number(day.slice(8))} ${MONTHS[Number(day.slice(5, 7)) - 1]}`;
export const rangeLabel = (r: DayRange) => `${short(r.from)} to ${short(r.to)} ${r.to.slice(0, 4)}`;
export const dayLabel = short;

export interface AnalyticsOverview extends OverviewResult {
  top: TopTitle[];
  splits: { device: SplitRow[]; connection: SplitRow[]; country: SplitRow[] };
  /** Shares per channel. Counters only, no person (L15a). */
  shares: ShareCount[];
}

export const SHARE_CHANNEL_NAMES: Record<string, string> = {
  copy: 'Copy link',
  whatsapp: 'WhatsApp',
  facebook: 'Facebook',
  x: 'X',
  telegram: 'Telegram',
  email: 'Email',
  sms: 'Messages (SMS)',
  more: 'Device share menu',
};
export interface VideoAnalytics {
  videoId: string;
  title: string;
  range: DayRange;
  daily: Array<{ day: string; views: number; watchMs: number }>;
  retention: RetentionPoint[];
  totals: { views: number; watchMs: number; completionRate: number };
  shares: ShareCount[];
}

// ---- fixture data, shaped exactly like the @ad/analytics results ----

const WATCH_MS_PER_VIEW = 7.5 * 60_000;
const share = (parts: Array<[string, number]>): SplitRow[] =>
  parts.map(([label, percent]) => ({ label, count: percent * 10, percent }));

function viewsFor(store: AdminStore, day: string, now: Date): number {
  const back = daysBetween(day, lagosDay(now)) - 1;
  const i = store.dailyViews.length - 1 - back;
  return i >= 0 && i < store.dailyViews.length ? store.dailyViews[i]! : 0;
}

function totals(daily: Array<{ views: number; watchMs: number }>): PeriodTotals {
  const views = daily.reduce((n, d) => n + d.views, 0);
  const watchMs = daily.reduce((n, d) => n + d.watchMs, 0);
  return {
    views,
    uniqueViewers: Math.round(views * 0.62),
    watchMs,
    avgWatchMsPerViewer: views ? watchMs / Math.round(views * 0.62) : 0,
    completionRate: views ? 0.41 : 0,
  };
}

function dailyFor(store: AdminStore, range: DayRange, now: Date) {
  const out: Array<{ day: string; views: number; watchMs: number }> = [];
  for (let day = range.from; day <= range.to; day = addDays(day, 1)) {
    const views = viewsFor(store, day, now);
    out.push({ day, views, watchMs: Math.round(views * WATCH_MS_PER_VIEW) });
  }
  return out;
}

export function buildFixtureOverview(
  store: AdminStore,
  range: DayRange,
  now: Date = new Date(),
): AnalyticsOverview {
  const daily = dailyFor(store, range, now);
  const published = store.videos.filter(
    (v) => v.deletedAt === null && v.publishState === 'published',
  );
  const top = [...published]
    .sort((a, b) => b.views - a.views)
    .slice(0, 10)
    .map((v, i): TopTitle => ({
      videoId: v.id,
      title: v.title,
      views: v.views,
      watchMs: Math.round(v.views * WATCH_MS_PER_VIEW),
      completionRate: Math.max(0.15, 0.6 - i * 0.04),
      avgPercentWatched: Math.max(20, 72 - i * 4),
    }));
  return {
    range,
    current: totals(daily),
    previous: totals(dailyFor(store, previousPeriod(range), now)),
    daily,
    top,
    shares: [
      { channel: 'whatsapp', count: 164 },
      { channel: 'copy', count: 91 },
      { channel: 'facebook', count: 38 },
      { channel: 'more', count: 22 },
    ],
    splits: {
      device: share([
        ['Phone', 71],
        ['Computer', 21],
        ['Tablet', 8],
      ]),
      connection: share([
        ['Fast', 52],
        ['Slow', 33],
        ['Data saver', 15],
      ]),
      country: share([
        ['Nigeria', 88],
        ['Ghana', 5],
        ['United Kingdom', 4],
        ['Other', 3],
      ]),
    },
  };
}

export function buildFixtureVideo(
  store: AdminStore,
  id: string,
  range: DayRange,
  now: Date = new Date(),
): VideoAnalytics | null {
  const video = store.videos.find((v) => v.id === id && v.deletedAt === null);
  if (!video) return null;
  const base = dailyFor(store, range, now);
  const scale = video.views > 0 ? Math.min(0.2, video.views / 60_000) : 0;
  const daily = base.map((d) => ({
    day: d.day,
    views: Math.round(d.views * scale),
    watchMs: Math.round(d.views * scale * WATCH_MS_PER_VIEW),
  }));
  const retention = Array.from({ length: 20 }, (_, i): RetentionPoint => ({
    atPercent: i * 5,
    percent: i === 0 ? 100 : Math.max(8, Math.round(100 - i * 3.6 - Math.sqrt(i) * 4)),
  }));
  const views = daily.reduce((n, d) => n + d.views, 0);
  return {
    videoId: id,
    title: video.title,
    range,
    daily,
    retention,
    totals: {
      views,
      watchMs: daily.reduce((n, d) => n + d.watchMs, 0),
      completionRate: views ? 0.38 : 0,
    },
    shares: views ? [
      { channel: 'whatsapp', count: Math.round(views / 40) },
      { channel: 'copy', count: Math.round(views / 90) },
    ].filter((r) => r.count > 0) : [],
  };
}

/** Fixture rows for the per title export, built from the same fixture daily numbers as the video screen. */
export function buildFixtureTitleDaily(
  store: AdminStore,
  range: DayRange,
  now: Date = new Date(),
): TitleDailyRow[] {
  const rows: TitleDailyRow[] = [];
  for (const video of store.videos) {
    const detail = buildFixtureVideo(store, video.id, range, now);
    if (!detail) continue;
    for (const d of detail.daily) {
      if (d.views === 0) continue;
      rows.push({
        day: d.day,
        videoId: video.id,
        title: video.title,
        archived: false,
        views: d.views,
        watchMs: d.watchMs,
        completions: Math.round(d.views * 0.38),
      });
    }
  }
  return rows.sort((a, b) => a.day.localeCompare(b.day) || a.title.localeCompare(b.title));
}

export type TopSortKey = 'views' | 'likes' | 'loves' | 'dislikes' | 'share';

/** Numbers the Top titles table shows for ratings. Share is null under ten ratings and undefined with none at all. */
export function ratingCells(t: TopTitle): { likes: number; loves: number; dislikes: number; share: number | null } | null {
  if (!t.ratings) return null;
  return { ...t.ratings, share: positiveShare(t.ratings) };
}

const sortValue = (t: TopTitle, key: TopSortKey): number | null => {
  if (key === 'views') return t.views;
  const cells = ratingCells(t);
  if (!cells) return null;
  return key === 'share' ? cells.share : cells[key];
};

/** Sorts a copy. Titles with no figure for the column always go last, whichever way it is sorted. */
export function sortTop(rows: readonly TopTitle[], key: TopSortKey, dir: 'asc' | 'desc'): TopTitle[] {
  const sign = dir === 'desc' ? -1 : 1;
  return rows
    .map((row, index) => ({ row, index, value: sortValue(row, key) }))
    .sort((a, b) => {
      if (a.value === null && b.value === null) return a.index - b.index;
      if (a.value === null) return 1;
      if (b.value === null) return -1;
      return sign * (a.value - b.value) || a.index - b.index;
    })
    .map((x) => x.row);
}
