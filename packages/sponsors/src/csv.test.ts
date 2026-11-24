import { describe, expect, it } from 'vitest';
import { REPORT_CSV_HEADER, csvCell, reportToCsv } from './csv';
import { buildReport } from './report';

describe('csvCell', () => {
  it('escapes commas, quotes and newlines', () => {
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('line1\nline2')).toBe('"line1\nline2"');
    expect(csvCell('plain')).toBe('plain');
  });
  it.each(['=1+1', '+SUM(A1)', '-2', '@cmd', '\tx', '\rx'])('neutralizes the formula start %j', (value) => {
    expect(csvCell(value).replace(/^"/, '').startsWith("'")).toBe(true);
  });
  it('leaves numbers alone', () => {
    expect(csvCell(-5)).toBe('-5');
    expect(csvCell(12)).toBe('12');
  });
});

describe('reportToCsv', () => {
  const rows = [{ day: '2027-01-01', creativeId: 'c1', slot: 'home_banner' as const, impressions: 10, clicks: 1, reach: 8 }];
  const report = buildReport({
    fromDay: '2027-01-01',
    toDay: '2027-01-02',
    rows,
    creativeNames: new Map([['c1', '=HYPERLINK("x")']]),
  });
  const csv = reportToCsv(report, 'Acme, Ltd', { rows });
  const lines = csv.trimEnd().split('\r\n');
  it('starts with the fixed header row', () => {
    expect(lines[0]).toBe(REPORT_CSV_HEADER.join(','));
    expect(REPORT_CSV_HEADER).toEqual(['sponsor', 'day', 'creative', 'placement', 'impressions', 'clicks', 'click_rate', 'daily_reach']);
  });
  it('escapes the sponsor name and neutralizes a formula in a headline', () => {
    expect(lines[1]).toContain('"Acme, Ltd"');
    expect(lines[1]).toContain("'=HYPERLINK");
  });
  it('writes one row per day, creative and placement that has data', () => {
    expect(lines).toHaveLength(2);
  });
  it('contains no personal data columns', () => {
    for (const bad of ['email', 'ip', 'viewer', 'profile', 'account', 'user']) {
      expect(REPORT_CSV_HEADER.some((h) => h.includes(bad))).toBe(false);
    }
  });
  it('ends with a line break', () => {
    expect(csv.endsWith('\r\n')).toBe(true);
  });
});
