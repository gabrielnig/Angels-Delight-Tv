import { describe, expect, it } from 'vitest';
import type { TitleDailyRow } from '@ad/analytics';
import { titleDailyCsv } from './analytics-export';

describe('titleDailyCsv', () => {
  const row = (over: Partial<TitleDailyRow> = {}): TitleDailyRow => ({
    day: '2026-11-16',
    videoId: 'v1',
    title: 'How Plants Make Food',
    archived: false,
    views: 12,
    watchMs: 90_500,
    completions: 3,
    ...over,
  });

  it('has a header and one line per title per day with exact watch seconds', () => {
    expect(titleDailyCsv([row(), row({ day: '2026-11-17', views: 0, watchMs: 400 })])).toBe(
      [
        'day,video_id,title,archived,views,watch_seconds,completions',
        '2026-11-16,v1,How Plants Make Food,no,12,91,3',
        '2026-11-17,v1,How Plants Make Food,no,0,0,3',
        '',
      ].join('\n'),
    );
  });

  it('gives headers only when there is nothing to export', () => {
    expect(titleDailyCsv([])).toBe('day,video_id,title,archived,views,watch_seconds,completions\n');
  });

  it('neutralises formulas and quotes commas in titles', () => {
    const csv = titleDailyCsv([
      row({ title: '=HYPERLINK("http://x","go")' }),
      row({ title: '+1,2' }),
      row({ title: '@SUM(A1)' }),
      row({ title: 'Plain, with comma', archived: true }),
    ]);
    const lines = csv.trim().split('\n');
    expect(lines[1]).toContain(`"'=HYPERLINK(""http://x"",""go"")"`);
    expect(lines[2]).toContain(`"'+1,2"`);
    expect(lines[3]).toContain(`'@SUM(A1)`);
    expect(lines[4]).toContain('"Plain, with comma",yes');
  });
});
