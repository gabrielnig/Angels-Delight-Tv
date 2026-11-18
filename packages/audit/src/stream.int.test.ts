import { schema } from '@ad/db';
import { createTestDatabase, integrationEnabled, type TestDatabase } from '@ad/db/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { iterateAudit } from './query';

describe.skipIf(!integrationEnabled())('iterateAudit', () => {
  let t: TestDatabase;
  beforeAll(async () => {
    t = await createTestDatabase();
    const rows = [];
    for (let i = 1; i <= 25; i += 1) {
      rows.push({
        action: i % 5 === 0 ? 'auth.login.failed' : 'video.edit',
        outcome: 'success' as const,
        targetId: `t${i}`,
      });
    }
    await t.db.insert(schema.auditLog).values(rows);
  });
  afterAll(async () => {
    await t?.drop();
  });

  const collect = async (it: AsyncIterable<{ id: number; action: string }[]>) => {
    const pages: Array<Array<{ id: number; action: string }>> = [];
    for await (const page of it) pages.push(page);
    return pages;
  };

  it('walks every row in pages bigger than the screen limit, newest first', async () => {
    const pages = await collect(iterateAudit(t.db, {}, { pageSize: 10 }));
    expect(pages.map((p) => p.length)).toEqual([10, 10, 5]);
    const ids = pages.flat().map((r) => r.id);
    expect(ids).toEqual([...ids].sort((a, b) => b - a));
    expect(new Set(ids).size).toBe(25);
  });

  it('is not held to the 200 row page limit of the screen list', async () => {
    const pages = await collect(iterateAudit(t.db, {}, { pageSize: 5000 }));
    expect(pages).toHaveLength(1);
    expect(pages[0]).toHaveLength(25);
  });

  it('applies the same filters and the same scope as the list, so an Admin export never gains security rows', async () => {
    const content = (
      await collect(iterateAudit(t.db, { scope: 'content' }, { pageSize: 10 }))
    ).flat();
    expect(content).toHaveLength(20);
    expect(content.every((r) => r.action === 'video.edit')).toBe(true);
    const one = (await collect(iterateAudit(t.db, { targetId: 't3' }, { pageSize: 10 }))).flat();
    expect(one).toHaveLength(1);
  });

  it('stops by itself when told to, so a cancelled export does not keep reading', async () => {
    const controller = new AbortController();
    const seen: number[] = [];
    for await (const page of iterateAudit(t.db, {}, { pageSize: 10, signal: controller.signal })) {
      seen.push(page.length);
      controller.abort();
    }
    expect(seen).toEqual([10]);
  });
});
