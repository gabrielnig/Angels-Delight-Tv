import { describe, expect, it } from 'vitest';
import {
  buildFixtureOverview,
  buildFixtureVideo,
  changeLabel,
  formatWatchTime,
  parseRange,
  rangeLabel,
} from './analytics-rules';
import { getStore } from './store';

const NOW = new Date('2026-11-17T10:00:00Z');

describe('parseRange', () => {
  it('defaults to the last 28 days ending today in Lagos', () => {
    expect(parseRange({}, NOW)).toEqual({
      preset: '28d',
      range: { from: '2026-10-21', to: '2026-11-17' },
    });
  });
  it('understands presets', () => {
    expect(parseRange({ range: '7d' }, NOW).range).toEqual({
      from: '2026-11-11',
      to: '2026-11-17',
    });
    expect(parseRange({ range: '90d' }, NOW).range.from).toBe('2026-08-20');
  });
  it('accepts a custom range and rejects backwards, huge or invalid ones', () => {
    expect(parseRange({ range: 'custom', from: '2026-11-01', to: '2026-11-10' }, NOW)).toEqual({
      preset: 'custom',
      range: { from: '2026-11-01', to: '2026-11-10' },
    });
    expect(parseRange({ range: 'custom', from: '2026-11-10', to: '2026-11-01' }, NOW).preset).toBe(
      '28d',
    );
    expect(parseRange({ range: 'custom', from: '2020-01-01', to: '2026-11-01' }, NOW).preset).toBe(
      '28d',
    );
    expect(parseRange({ range: 'custom', from: 'x', to: 'y' }, NOW).preset).toBe('28d');
  });
});

describe('labels', () => {
  it('describes change in words with direction', () => {
    expect(changeLabel(120, 100)).toEqual({
      text: 'Up 20% from the period before',
      direction: 'up',
    });
    expect(changeLabel(80, 100)).toEqual({
      text: 'Down 20% from the period before',
      direction: 'down',
    });
    expect(changeLabel(5, 0)).toEqual({ text: 'No data for the period before', direction: 'none' });
    expect(changeLabel(100, 100).direction).toBe('flat');
  });
  it('formats watch time', () => {
    expect(formatWatchTime(0)).toBe('0 min');
    expect(formatWatchTime(90 * 60_000)).toBe('1 h 30 min');
    expect(formatWatchTime(26 * 3_600_000)).toBe('26 h');
  });
  it('labels a range', () => {
    expect(rangeLabel({ from: '2026-11-01', to: '2026-11-10' })).toBe('1 Nov to 10 Nov 2026');
  });
});

describe('fixture results', () => {
  it('builds an overview with a daily point for every day in range', () => {
    const o = buildFixtureOverview(getStore(), { from: '2026-11-01', to: '2026-11-10' });
    expect(o.daily).toHaveLength(10);
    expect(o.current.views).toBe(o.daily.reduce((n, d) => n + d.views, 0));
    expect(o.top.length).toBeGreaterThan(0);
    expect(o.splits.device.reduce((n, r) => n + r.percent, 0)).toBeCloseTo(100, 0);
  });
  it('builds a per video view with a falling retention curve', () => {
    const s = getStore();
    const v = buildFixtureVideo(s, s.videos.find((x) => x.publishState === 'published')!.id, {
      from: '2026-11-01',
      to: '2026-11-07',
    })!;
    expect(v.retention).toHaveLength(20);
    expect(v.retention[0]!.percent).toBe(100);
    expect(v.retention.at(-1)!.percent).toBeLessThan(v.retention[0]!.percent);
  });
  it('returns null for an unknown video', () => {
    expect(
      buildFixtureVideo(getStore(), 'nope', { from: '2026-11-01', to: '2026-11-07' }),
    ).toBeNull();
  });
});
