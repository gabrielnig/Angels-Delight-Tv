import { describe, expect, it } from 'vitest';
import {
  auditScopeFor,
  filterAudit,
  parseAuditQuery,
  serializeAuditQuery,
  toAdminRow,
  toCsv,
} from './audit-adapter';
import { getStore } from './store';

const rows = () => structuredClone(getStore().audit);

describe('toAdminRow', () => {
  it('maps a package record, reading summary and changes from metadata', () => {
    const row = toAdminRow({
      id: 7,
      occurredAt: new Date('2026-11-17T10:00:00Z'),
      actorAccountId: 'a1b2c3d4-0000-0000-0000-000000000000',
      actorRole: 'admin',
      action: 'video.publish',
      outcome: 'success',
      targetType: 'video',
      targetId: 'v1',
      ipTrunc: '102.89.0.0',
      requestId: 'r1',
      metadata: {
        summary: 'Published a video',
        before: { state: 'draft' },
        after: { state: 'published' },
      },
    });
    expect(row).toMatchObject({
      id: 7,
      at: '2026-11-17T10:00:00.000Z',
      summary: 'Published a video',
      before: { state: 'draft' },
      after: { state: 'published' },
    });
    expect(row.actorName).toBe('admin a1b2c3d4');
  });
  it('has safe defaults when metadata is empty', () => {
    const row = toAdminRow({
      id: 1,
      occurredAt: new Date(0),
      actorAccountId: null,
      actorRole: null,
      action: 'auth.login_failed',
      outcome: 'failure',
      targetType: null,
      targetId: null,
      ipTrunc: null,
      requestId: null,
      metadata: {},
    });
    expect(row).toMatchObject({
      summary: 'auth.login_failed',
      before: null,
      after: null,
      actorName: 'Unknown',
    });
  });
});

describe('query parsing', () => {
  it('ignores junk and round trips', () => {
    expect(parseAuditQuery({ outcome: 'bogus', action: 'x'.repeat(200), from: 'nope' })).toEqual({
      action: 'x'.repeat(80),
    });
    const q = parseAuditQuery({
      action: 'video.',
      outcome: 'denied',
      from: '2026-11-01',
      to: '2026-11-30',
      entry: '4',
    });
    expect(
      parseAuditQuery(Object.fromEntries(new URLSearchParams(serializeAuditQuery(q)))),
    ).toEqual(q);
  });
});

describe('filterAudit', () => {
  it('filters by action prefix, outcome and dates', () => {
    const all = rows();
    expect(filterAudit(all, { action: 'video.' }).every((r) => r.action.startsWith('video.'))).toBe(
      true,
    );
    expect(filterAudit(all, { outcome: 'failure' }).every((r) => r.outcome === 'failure')).toBe(
      true,
    );
    expect(filterAudit(all, { from: '2999-01-01' })).toHaveLength(0);
  });
});

describe('audit scope by role (M20-S02 AC3)', () => {
  it('gives a Super admin every entry and everyone else content actions only', () => {
    expect(auditScopeFor('super_admin')).toBe('all');
    expect(auditScopeFor('admin')).toBe('content');
    expect(auditScopeFor('editor')).toBe('content');
    expect(auditScopeFor('viewer')).toBe('content');
    expect(auditScopeFor(null)).toBe('content');
    expect(auditScopeFor('owner' as never)).toBe('content');
  });
  it('hides security and staff entries from the content scope in fixtures too', () => {
    const list = [
      { action: 'video.publish' },
      { action: 'auth.login_failed' },
      { action: 'admin.role_changed' },
      { action: 'staff.invite' },
      { action: 'settings.site' },
    ].map((r, i) => ({ ...rows()[0]!, ...r, id: i + 1 }));
    expect(filterAudit(list, {}, 'content').map((r) => r.action)).toEqual([
      'video.publish',
      'settings.site',
    ]);
    expect(filterAudit(list, {}, 'all')).toHaveLength(5);
  });
});

describe('toCsv', () => {
  it('neutralises formulas', () => {
    const r = rows()[0]!;
    const csv = toCsv([{ ...r, summary: '=HYPERLINK("x")' }]);
    expect(csv.split('\n')[0]).toContain('summary');
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
  });
});
