import { describe, expect, it } from 'vitest';
import { REPORT_MAX_DAYS, buildReport, checkRange, defaultRange, parseReportRange, type StatRow } from './report';

const A = '0190a000-0000-7000-8000-00000000000a';
const B = '0190a000-0000-7000-8000-00000000000b';
const names = new Map([[A, 'Banner'], [B, 'Card']]);
const row = (over: Partial<StatRow>): StatRow => ({
  day: '2027-01-01',
  creativeId: A,
  slot: 'home_banner',
  impressions: 0,
  clicks: 0,
  reach: 0,
  ...over,
});

describe('buildReport', () => {
  it('sums impressions and clicks across the range', () => {
    const r = buildReport({
      fromDay: '2027-01-01',
      toDay: '2027-01-03',
      rows: [row({ impressions: 100, clicks: 4 }), row({ day: '2027-01-03', impressions: 50, clicks: 1 })],
      creativeNames: names,
    });
    expect(r.totals.impressions).toBe(150);
    expect(r.totals.clicks).toBe(5);
  });
  it('click rate is zero when there are no impressions', () => {
    const r = buildReport({ fromDay: '2027-01-01', toDay: '2027-01-02', rows: [row({ clicks: 3 })], creativeNames: names });
    expect(r.totals.clickRate).toBe(0);
    expect(r.days.every((d) => d.clickRate === 0)).toBe(true);
  });
  it('works out the click rate as a fraction', () => {
    const r = buildReport({ fromDay: '2027-01-01', toDay: '2027-01-01', rows: [row({ impressions: 200, clicks: 5 })], creativeNames: names });
    expect(r.totals.clickRate).toBeCloseTo(0.025, 6);
  });
  it('groups by creative and by placement', () => {
    const r = buildReport({
      fromDay: '2027-01-01',
      toDay: '2027-01-01',
      rows: [
        row({ impressions: 10, clicks: 1 }),
        row({ creativeId: B, slot: 'title_card', impressions: 20, clicks: 2 }),
        row({ creativeId: B, slot: 'home_banner', impressions: 5, clicks: 0 }),
      ],
      creativeNames: names,
    });
    expect(r.byCreative.find((c) => c.creativeId === B)).toMatchObject({ headline: 'Card', impressions: 25, clicks: 2 });
    expect(r.bySlot.find((s) => s.slot === 'home_banner')).toMatchObject({ impressions: 15, clicks: 1 });
    expect(r.bySlot.find((s) => s.slot === 'title_card')).toMatchObject({ impressions: 20 });
  });
  it('zero fills days with no data, in order', () => {
    const r = buildReport({ fromDay: '2027-02-27', toDay: '2027-03-02', rows: [row({ day: '2027-03-01', impressions: 7 })], creativeNames: names });
    expect(r.days.map((d) => d.day)).toEqual(['2027-02-27', '2027-02-28', '2027-03-01', '2027-03-02']);
    expect(r.days.map((d) => d.impressions)).toEqual([0, 0, 7, 0]);
  });
  it('labels reach as daily and never sums it as unique people', () => {
    const r = buildReport({
      fromDay: '2027-01-01',
      toDay: '2027-01-02',
      rows: [row({ reach: 40 }), row({ day: '2027-01-02', reach: 60 })],
      creativeNames: names,
    });
    expect(r.totals).not.toHaveProperty('reach');
    expect(r.totals.peakDailyReach).toBe(60);
    expect(r.days.map((d) => d.dailyReach)).toEqual([40, 60]);
    expect(r.reachNote).toMatch(/daily/i);
    expect(r.reachNote).toMatch(/not added up/i);
  });
  it('sums reach across slots of one creative on one day as an upper bound only', () => {
    const r = buildReport({
      fromDay: '2027-01-01',
      toDay: '2027-01-01',
      rows: [row({ reach: 10 }), row({ slot: 'title_card', reach: 15 })],
      creativeNames: names,
    });
    expect(r.days[0]!.dailyReach).toBe(25);
  });
  it('uses a placeholder name for a creative that was deleted', () => {
    const r = buildReport({ fromDay: '2027-01-01', toDay: '2027-01-01', rows: [row({ creativeId: B, impressions: 1 })], creativeNames: new Map() });
    expect(r.byCreative[0]!.headline).toBe('Removed creative');
  });
});

describe('checkRange', () => {
  it('accepts a normal range', () => {
    expect(checkRange('2027-01-01', '2027-01-31')).toEqual({ ok: true });
  });
  it('allows exactly 400 days and refuses 401', () => {
    expect(REPORT_MAX_DAYS).toBe(400);
    expect(checkRange('2026-01-01', '2027-02-04').ok).toBe(true);
    expect(checkRange('2026-01-01', '2027-02-05').ok).toBe(false);
  });
  it('refuses reversed, malformed and impossible dates', () => {
    expect(checkRange('2027-02-01', '2027-01-01').ok).toBe(false);
    expect(checkRange('2027-1-1', '2027-01-02').ok).toBe(false);
    expect(checkRange('2027-02-30', '2027-03-01').ok).toBe(false);
    expect(checkRange('', '').ok).toBe(false);
  });
});

describe('parseReportRange', () => {
  const now = new Date('2027-03-10T23:30:00Z'); // 00:30 on 11 March in Lagos
  it('defaults to the last 30 Lagos days', () => {
    expect(defaultRange(now)).toEqual({ fromDay: '2027-02-10', toDay: '2027-03-11' });
    expect(parseReportRange({}, now)).toEqual({ fromDay: '2027-02-10', toDay: '2027-03-11' });
  });
  it('uses a valid range from the query', () => {
    expect(parseReportRange({ from: '2027-01-01', to: '2027-01-31' }, now)).toEqual({ fromDay: '2027-01-01', toDay: '2027-01-31' });
  });
  it('falls back to the default for a bad or too long range', () => {
    expect(parseReportRange({ from: 'x', to: 'y' }, now)).toEqual(defaultRange(now));
    expect(parseReportRange({ from: '2020-01-01', to: '2027-01-01' }, now)).toEqual(defaultRange(now));
    expect(parseReportRange({ from: ['2027-01-01'], to: undefined }, now)).toEqual(defaultRange(now));
  });
});
