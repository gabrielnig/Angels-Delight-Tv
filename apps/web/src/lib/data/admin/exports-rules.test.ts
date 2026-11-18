import { describe, expect, it } from 'vitest';
import {
  EXPORT_PERMISSION,
  INLINE_EXPORT_MAX,
  exportFileName,
  exportName,
  parseExportRequest,
  toQueryString,
} from './exports-rules';

describe('export rules', () => {
  it('sends anything over 10,000 rows to the background', () => {
    expect(INLINE_EXPORT_MAX).toBe(10_000);
  });

  it('needs the audit export permission for the audit log and analytics access for analytics', () => {
    expect(EXPORT_PERMISSION).toEqual({ audit: 'audit.export', analytics: 'analytics.view' });
  });

  describe('parseExportRequest', () => {
    it('keeps only the audit filters it knows, trimmed and shortened', () => {
      const parsed = parseExportRequest('audit', {
        action: ' video. ',
        outcome: 'denied',
        from: '2026-06-01',
        to: '2026-06-02',
        cursor: '99',
        entry: '4',
        scope: 'all',
        junk: 'x',
      });
      expect(parsed).toEqual({
        kind: 'audit',
        params: { action: 'video.', outcome: 'denied', from: '2026-06-01', to: '2026-06-02' },
      });
    });

    it('drops an outcome or day it does not recognise', () => {
      const parsed = parseExportRequest('audit', { outcome: 'maybe', from: 'last week' });
      expect(parsed).toEqual({ kind: 'audit', params: {} });
    });

    it('takes an analytics range from the dates, and falls back to a real range for nonsense', () => {
      const ok = parseExportRequest(
        'analytics',
        { from: '2026-01-01', to: '2026-02-01' },
        new Date('2026-06-01T00:00:00Z'),
      );
      expect(ok).toEqual({ kind: 'analytics', params: { from: '2026-01-01', to: '2026-02-01' } });
      const bad = parseExportRequest(
        'analytics',
        { from: 'x', to: 'y' },
        new Date('2026-06-01T00:00:00Z'),
      );
      expect(bad?.params.to).toBe('2026-06-01');
      expect(bad?.params.from).toBe('2026-05-05');
    });

    it('refuses a kind it does not know', () => {
      expect(parseExportRequest('users', {})).toBeNull();
      expect(parseExportRequest(undefined, {})).toBeNull();
      expect(parseExportRequest(['audit'], {})).toBeNull();
    });
  });

  it('names a file by what it holds and when it was asked for', () => {
    expect(exportName('audit')).toBe('Audit log');
    expect(exportFileName('audit', {}, new Date('2026-06-10T10:00:00Z'))).toBe(
      'audit-log-2026-06-10.csv',
    );
    expect(
      exportFileName(
        'analytics',
        { from: '2026-01-01', to: '2026-03-31' },
        new Date('2026-06-10T10:00:00Z'),
      ),
    ).toBe('analytics-2026-01-01-to-2026-03-31.csv');
  });

  it('turns a request into a query string and back', () => {
    const qs = toQueryString({ kind: 'audit', params: { action: 'video.', from: '2026-06-01' } });
    const back = Object.fromEntries(new URLSearchParams(qs));
    expect(parseExportRequest(back.kind, back)).toEqual({
      kind: 'audit',
      params: { action: 'video.', from: '2026-06-01' },
    });
  });
});
