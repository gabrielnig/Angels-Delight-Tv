import { schema, type Database } from '@ad/db';
import {
  asRole,
  createTestDatabase,
  integrationEnabled,
  makeAccount,
  makeVideo,
  type TestDatabase,
} from '@ad/db/testing';
import { uuidv7 } from '@ad/shared';
import { drizzle } from 'drizzle-orm/node-postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { makePrunes } from './prunes';

describe.skipIf(!integrationEnabled())('prunes read their retention from settings', () => {
  let t: TestDatabase;
  const asWorker = <T>(fn: (db: Database) => Promise<T>) =>
    asRole(t.pool, 'ad_worker', {}, (client) =>
      fn(drizzle(client, { schema }) as unknown as Database),
    );

  beforeAll(async () => {
    t = await createTestDatabase();
  });
  afterAll(async () => {
    await t?.drop();
  });

  /** The maintenance role holds its own connection, so the worker role runs on another client. */
  async function runPrunes<T>(pick: (p: ReturnType<typeof makePrunes>) => Promise<T>): Promise<T> {
    const maintenance = await t.pool.connect();
    try {
      await maintenance.query('BEGIN');
      await maintenance.query('SET LOCAL ROLE ad_maintenance');
      const result = await asWorker((writer) =>
        pick(makePrunes(drizzle(maintenance, { schema }) as unknown as Database, writer)),
      );
      await maintenance.query('COMMIT');
      return result;
    } finally {
      maintenance.release();
    }
  }

  async function seedAudit(target: string, monthsAgo: number) {
    await t.db
      .insert(schema.auditLog)
      .values({ action: 'video.edit', outcome: 'success', targetId: target });
    await t.pool.query('alter table audit_log disable trigger audit_log_no_update_delete');
    await t.pool.query(
      `update audit_log set occurred_at = now() - interval '${monthsAgo} months' where target_id = $1`,
      [target],
    );
    await t.pool.query('alter table audit_log enable trigger audit_log_no_update_delete');
  }
  const auditCount = async (target: string) =>
    (await t.pool.query('select count(*)::int as n from audit_log where target_id = $1', [target]))
      .rows[0].n as number;

  it('purges audit entries by the stored months, defaulting to 24', async () => {
    await seedAudit('ten-months', 10);
    await seedAudit('thirty-months', 30);
    const first = (await runPrunes((p) => p.pruneAudit())) as { deleted: number };
    expect(first.deleted).toBe(1);
    expect(await auditCount('ten-months')).toBe(1);
    expect(await auditCount('thirty-months')).toBe(0);

    await t.db
      .insert(schema.settings)
      .values({ key: 'audit.retention_months', value: 6, isPublic: false });
    const second = (await runPrunes((p) => p.pruneAudit())) as { deleted: number };
    expect(second.deleted).toBe(1);
    expect(await auditCount('ten-months')).toBe(0);
  });

  it('prunes raw view events by the stored days', async () => {
    const video = makeVideo({ status: 'ready', durationMs: 60_000 });
    await t.db.insert(schema.videos).values(video);
    const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);
    for (const startedAt of [daysAgo(200), daysAgo(20)]) {
      await t.db.insert(schema.viewEvents).values({
        playId: uuidv7(),
        videoId: video.id,
        audience: 'general',
        startedAt,
        watchedMs: 1000,
      });
    }
    const left = async () =>
      (await t.pool.query('select count(*)::int as n from view_events')).rows[0].n as number;
    await t.db
      .insert(schema.settings)
      .values({ key: 'analytics.raw_retention_days', value: 365, isPublic: false });
    await runPrunes((p) => p.pruneViewEvents());
    expect(await left()).toBe(2);
    await t.pool.query(
      "update settings set value = '90'::jsonb where key = 'analytics.raw_retention_days'",
    );
    await runPrunes((p) => p.pruneViewEvents());
    expect(await left()).toBe(1);
  });

  it('prunes sign in history older than 90 days with the maintenance role', async () => {
    const account = makeAccount();
    await t.db.insert(schema.accounts).values(account);
    const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);
    for (const at of [daysAgo(120), daysAgo(91), daysAgo(10)]) {
      await t.db
        .insert(schema.loginEvents)
        .values({ accountId: account.id, outcome: 'success', at });
    }
    const removed = await runPrunes((p) => p.pruneLoginEvents());
    expect(removed).toBe(2);
    const left = (await t.pool.query('select count(*)::int as n from login_events')).rows[0]
      .n as number;
    expect(left).toBe(1);
  });
});
