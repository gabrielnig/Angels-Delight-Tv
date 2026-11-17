import { schema } from '@ad/db';
import { asRole, createTestDatabase, integrationEnabled, type TestDatabase } from '@ad/db/testing';
import { uuidv7 } from '@ad/shared';
import { drizzle } from 'drizzle-orm/node-postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { auditCsv } from './csv';
import { countAudit, getAuditEntry, listAudit } from './query';
import { pruneAudit } from './retention';
import { recordAudit, withAudit, writeAudit, AuditWriteError } from './writer';

describe.skipIf(!integrationEnabled())('audit log on Postgres', () => {
  let t: TestDatabase;
  const actor = uuidv7();
  const other = uuidv7();

  beforeAll(async () => {
    t = await createTestDatabase();
  });
  afterAll(async () => {
    await t?.drop();
  });

  const asApp = <T>(fn: (db: ReturnType<typeof drizzle<typeof schema>>) => Promise<T>) =>
    asRole(t.pool, 'ad_app', {}, (client) => fn(drizzle(client, { schema })));

  it('writes entries as ad_app and lists them newest first with cursor pagination', async () => {
    await asApp(async (db) => {
      for (let i = 1; i <= 5; i += 1) {
        await writeAudit(db, {
          action: 'video.edit',
          outcome: 'success',
          actorAccountId: actor,
          actorRole: 'admin',
          targetType: 'video',
          targetId: `v${i}`,
          summary: `Edit ${i}`,
        });
      }
      await writeAudit(db, {
        action: 'auth.login.failed',
        outcome: 'denied',
        actorAccountId: other,
      });
      await writeAudit(db, { action: 'theme.publish', outcome: 'success', actorAccountId: actor });
    });
    const first = await listAudit(t.db, {}, { limit: 3 });
    expect(first.items.map((e) => e.action)).toEqual([
      'theme.publish',
      'auth.login.failed',
      'video.edit',
    ]);
    expect(first.nextCursor).not.toBeNull();
    const second = await listAudit(t.db, {}, { limit: 3, cursor: first.nextCursor });
    expect(second.items).toHaveLength(3);
    expect(second.items[0]!.id).toBeLessThan(first.items.at(-1)!.id);
    const third = await listAudit(t.db, {}, { limit: 3, cursor: second.nextCursor });
    expect(third.items).toHaveLength(1);
    expect(third.nextCursor).toBeNull();
  });

  it('filters by actor, action prefix, target, outcome and scope', async () => {
    expect((await listAudit(t.db, { actorAccountId: other })).items).toHaveLength(1);
    expect((await listAudit(t.db, { action: 'video.' })).items).toHaveLength(5);
    expect((await listAudit(t.db, { action: 'theme.publish' })).items).toHaveLength(1);
    expect((await listAudit(t.db, { targetType: 'video', targetId: 'v3' })).items).toHaveLength(1);
    expect((await listAudit(t.db, { outcome: 'denied' })).items).toHaveLength(1);
    const content = await listAudit(t.db, { scope: 'content' });
    expect(content.items.some((e) => e.action.startsWith('auth.'))).toBe(false);
    expect(content.items).toHaveLength(6);
    expect(await countAudit(t.db, { scope: 'content' })).toBe(6);
    const future = await listAudit(t.db, { from: new Date(Date.now() + 86_400_000) });
    expect(future.items).toHaveLength(0);
  });

  it('hides security entries from the content scope on a detail lookup', async () => {
    const security = (await listAudit(t.db, { action: 'auth.login.failed' })).items[0]!;
    expect(await getAuditEntry(t.db, security.id, 'content')).toBeNull();
    expect(await getAuditEntry(t.db, security.id, 'all')).not.toBeNull();
  });

  it('rolls the action back when the audit write fails', async () => {
    const db = drizzle(t.pool, { schema });
    await expect(
      withAudit(
        db,
        async (tx) => {
          await tx
            .insert(schema.settings)
            .values({ key: 'platform.name', value: 'Changed' } as never);
          return 'done';
        },
        () => ({ action: 'bad action', outcome: 'success' }),
      ),
    ).rejects.toThrow();
    const rows = await t.pool.query(
      "select 1 from settings where key = 'platform.name' and value = '\"Changed\"'",
    );
    expect(rows.rowCount).toBe(0);
  });

  it('commits the action and the entry together', async () => {
    const db = drizzle(t.pool, { schema });
    const before = await countAudit(t.db);
    await withAudit(
      db,
      async () => 'ok',
      () => ({ action: 'settings.site', outcome: 'success', summary: 'Changed site name' }),
    );
    expect(await countAudit(t.db)).toBe(before + 1);
  });

  it('wraps a database failure and lets recordAudit swallow it', async () => {
    const broken = { insert: () => ({ values: () => Promise.reject(new Error('down')) }) } as never;
    await expect(
      writeAudit(broken, { action: 'video.edit', outcome: 'success' }),
    ).rejects.toBeInstanceOf(AuditWriteError);
    let seen: unknown;
    await recordAudit(broken, { action: 'video.edit', outcome: 'success' }, (e) => (seen = e));
    expect(seen).toBeInstanceOf(AuditWriteError);
  });

  it('cannot be edited or deleted by the app role', async () => {
    await expect(
      asRole(t.pool, 'ad_app', {}, (c) => c.query('delete from audit_log')),
    ).rejects.toThrow();
    await expect(
      asRole(t.pool, 'ad_app', {}, (c) => c.query("update audit_log set action = 'x.y'")),
    ).rejects.toThrow();
  });

  it('purges old entries as the maintenance role and logs the purge', async () => {
    await t.pool.query('alter table audit_log disable trigger audit_log_no_update_delete');
    await t.pool.query(
      "update audit_log set occurred_at = now() - interval '30 months' where target_id in ('v1','v2')",
    );
    await t.pool.query('alter table audit_log enable trigger audit_log_no_update_delete');
    const result = await asRole(t.pool, 'ad_maintenance', {}, async (client) => {
      const writer = drizzle(t.pool, { schema });
      return pruneAudit(drizzle(client), writer, { now: new Date() });
    });
    expect(result.deleted).toBe(2);
    const purge = (await listAudit(t.db, { action: 'audit.retention.purge' })).items[0]!;
    expect(purge.metadata).toMatchObject({ deleted: 2 });
    expect((await listAudit(t.db, { targetId: 'v1' })).items).toHaveLength(0);
  });

  it('honours a legal hold', async () => {
    const result = await asRole(t.pool, 'ad_maintenance', {}, (client) =>
      pruneAudit(drizzle(client), drizzle(t.pool, { schema }), { legalHold: true }),
    );
    expect(result).toMatchObject({ deleted: 0, skipped: 'legal_hold' });
  });

  it('exports a csv with a header for an empty filter and rows otherwise', async () => {
    const all = await listAudit(t.db, {}, { limit: 200 });
    expect(auditCsv(all.items).trim().split('\n').length).toBe(all.items.length + 1);
    expect(auditCsv([]).trim().split('\n')).toHaveLength(1);
  });
});
