import { describe, expect, it } from 'vitest';
import { AuditEntryInvalid, buildAuditRow } from './entry';

const base = { action: 'video.publish', outcome: 'success' as const };

describe('buildAuditRow', () => {
  it('maps an entry to a row with the summary, diff and user agent in metadata', () => {
    const row = buildAuditRow({
      ...base,
      actorAccountId: '0b7f6d52-1c3e-4a58-8f19-2a4c6e8d0b31',
      actorRole: 'admin',
      targetType: 'video',
      targetId: 'abc',
      ip: '203.0.113.77',
      userAgent: 'Mozilla/5.0 test',
      requestId: 'req_1',
      summary: 'Published How Plants Make Food',
      before: { publishState: 'draft' },
      after: { publishState: 'published' },
    });
    expect(row).toMatchObject({
      action: 'video.publish',
      outcome: 'success',
      actorRole: 'admin',
      targetType: 'video',
      targetId: 'abc',
      ipTrunc: '203.0.113.0/24',
      requestId: 'req_1',
    });
    expect(row.metadata).toMatchObject({
      summary: 'Published How Plants Make Food',
      before: { publishState: 'draft' },
      after: { publishState: 'published' },
      userAgent: 'Mozilla/5.0 test',
    });
  });

  it('stores only changed fields and redacts secrets', () => {
    const row = buildAuditRow({
      ...base,
      before: { a: 1, apiKey: 'x' },
      after: { a: 2, apiKey: 'y' },
    });
    expect(row.metadata).toMatchObject({
      before: { a: 1, apiKey: '[redacted]' },
      after: { a: 2, apiKey: '[redacted]' },
    });
  });

  it('never stores a raw ip, only the truncated one', () => {
    const row = buildAuditRow({ ...base, ip: '2001:db8:abcd:1234::1' });
    expect(JSON.stringify(row)).not.toContain('1234');
    expect(row.ipTrunc).toBe('2001:db8:abcd::/48');
  });

  it('rejects unnamespaced actions and unknown outcomes', () => {
    expect(() => buildAuditRow({ ...base, action: 'publish' })).toThrow(AuditEntryInvalid);
    expect(() => buildAuditRow({ ...base, action: 'Video.Publish' })).toThrow(AuditEntryInvalid);
    expect(() => buildAuditRow({ ...base, outcome: 'maybe' as never })).toThrow(AuditEntryInvalid);
  });

  it('caps metadata size and marks it truncated', () => {
    const big = Object.fromEntries(
      Array.from({ length: 200 }, (_, i) => [`field${i}`, 'y'.repeat(400)]),
    );
    const row = buildAuditRow({ ...base, before: {}, after: big });
    expect(JSON.stringify(row.metadata).length).toBeLessThan(9000);
    expect(row.metadata).toMatchObject({ truncated: true });
  });

  it('truncates the user agent', () => {
    const row = buildAuditRow({ ...base, userAgent: 'a'.repeat(500) });
    expect(String((row.metadata as { userAgent: string }).userAgent).length).toBeLessThanOrEqual(
      160,
    );
  });
});
