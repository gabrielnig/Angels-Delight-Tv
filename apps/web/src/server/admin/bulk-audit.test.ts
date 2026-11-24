import type { AuditEntry } from '@ad/audit';
import { describe, expect, it } from 'vitest';
import { emptyOutcome } from '@/lib/data/admin/bulk';
import { recordBulk } from './bulk-audit';

const actor = { accountId: 'acc-1', role: 'admin' as const };

function fake() {
  const rows: AuditEntry[] = [];
  return { rows, write: async (entry: AuditEntry) => void rows.push(entry) };
}

describe('recordBulk', () => {
  it('writes one bulk.run row and one row per changed item with the same bulkId', async () => {
    const { rows, write } = fake();
    const outcome = { ...emptyOutcome('bulk-1'), succeeded: ['a', 'b'], failed: [{ id: 'c', reason: 'x' }] };
    await recordBulk(write, actor, {
      action: 'video.publish',
      label: 'Publish',
      targetType: 'video',
      bulkId: 'bulk-1',
      ids: ['a', 'b', 'c'],
      outcome,
    });
    const run = rows.filter((r) => r.action === 'bulk.run');
    expect(run).toHaveLength(1);
    expect(run[0]?.extra).toMatchObject({ bulkId: 'bulk-1', label: 'Publish', succeeded: 1 + 1, failed: 1, skipped: 0 });
    const items = rows.filter((r) => r.action === 'video.publish');
    expect(items.map((r) => r.targetId)).toEqual(['a', 'b']);
    expect(items.every((r) => r.extra?.bulkId === 'bulk-1')).toBe(true);
    expect(items.every((r) => r.actorAccountId === 'acc-1' && r.outcome === 'success')).toBe(true);
  });

  it('keeps the shared reason on the summary row', async () => {
    const { rows, write } = fake();
    await recordBulk(write, actor, {
      action: 'user.bulk_suspend',
      label: 'Suspend accounts',
      targetType: 'user',
      bulkId: 'b',
      ids: ['a'],
      outcome: { ...emptyOutcome('b'), succeeded: ['a'] },
      reason: 'Abuse reports',
      itemRows: false,
    });
    expect(rows[0]?.extra).toMatchObject({ reason: 'Abuse reports' });
  });

  it('caps the id list in the summary at 50', async () => {
    const { rows, write } = fake();
    const ids = Array.from({ length: 120 }, (_, i) => `id-${i}`);
    await recordBulk(write, actor, {
      action: 'video.trash',
      label: 'Trash',
      targetType: 'video',
      bulkId: 'b',
      ids,
      outcome: { ...emptyOutcome('b'), succeeded: ids },
      itemRows: false,
    });
    const run = rows.find((r) => r.action === 'bulk.run');
    expect((run?.extra?.ids as string[]).length).toBe(50);
    expect(run?.extra?.idsTruncated).toBe(true);
    expect(rows).toHaveLength(1);
  });

  it('denied runs write outcome denied', async () => {
    const { rows, write } = fake();
    await recordBulk(write, { accountId: 'acc-2', role: 'editor' }, {
      action: 'video.trash',
      label: 'Trash',
      targetType: 'video',
      bulkId: 'b',
      ids: ['a', 'b'],
      denied: true,
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ action: 'bulk.run', outcome: 'denied', actorRole: 'editor' });
  });
});
