import { pruneViewEvents, runNightlyRollup } from '@ad/analytics';
import { pruneAudit } from '@ad/audit';
import { schema, type Database } from '@ad/db';
import { asRole, createTestDatabase, integrationEnabled, makeVideo, type TestDatabase } from '@ad/db/testing';
import { uuidv7 } from '@ad/shared';
import { drizzle } from 'drizzle-orm/node-postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/** The same calls `buildMaintenanceDeps` makes, but under the real service roles so grants are exercised. */
describe.skipIf(!integrationEnabled())('maintenance jobs under the worker and maintenance roles', () => {
  let t: TestDatabase;
  const as = <T>(role: 'ad_worker' | 'ad_maintenance', fn: (db: Database) => Promise<T>) =>
    asRole(t.pool, role, {}, (client) => fn(drizzle(client, { schema }) as unknown as Database));

  beforeAll(async () => {
    t = await createTestDatabase();
  });
  afterAll(async () => {
    await t?.drop();
  });

  it('rolls up yesterday as ad_worker', async () => {
    const video = makeVideo({ status: 'ready', durationMs: 60_000 });
    await t.db.insert(schema.videos).values(video);
    const now = new Date('2026-11-17T10:00:00Z');
    await t.db.insert(schema.viewEvents).values({
      playId: uuidv7(),
      videoId: video.id,
      audience: 'general',
      startedAt: new Date('2026-11-16T09:00:00Z'),
      watchedMs: 30_000,
    });
    const days = await as('ad_worker', (db) => runNightlyRollup(db, now));
    expect(days).toEqual(['2026-11-15', '2026-11-16']);
    const rows = await t.db.select().from(schema.videoDailyStats);
    expect(rows.some((row) => row.videoId === video.id && row.views === 1)).toBe(true);
  });

  it('prunes raw view events as ad_maintenance', async () => {
    const [video] = await t.db.select({ id: schema.videos.id }).from(schema.videos).limit(1);
    await t.db.insert(schema.viewEvents).values({
      playId: uuidv7(),
      videoId: video!.id,
      audience: 'general',
      startedAt: new Date('2020-01-01T00:00:00Z'),
      watchedMs: 1000,
    });
    await as('ad_maintenance', (db) => pruneViewEvents(db, { now: new Date('2026-11-17T00:00:00Z') }));
    const old = await t.pool.query("select count(*)::int as n from view_events where started_at < '2021-01-01'");
    expect(old.rows[0].n).toBe(0);
  });

  it('prunes the audit log as ad_maintenance and records the purge as ad_worker', async () => {
    await t.db.insert(schema.auditLog).values({
      action: 'video.edit',
      outcome: 'success',
      targetId: 'old-one',
    });
    await t.pool.query('alter table audit_log disable trigger audit_log_no_update_delete');
    await t.pool.query("update audit_log set occurred_at = now() - interval '30 months' where target_id = 'old-one'");
    await t.pool.query('alter table audit_log enable trigger audit_log_no_update_delete');

    const maintenance = await t.pool.connect();
    try {
      await maintenance.query('BEGIN');
      await maintenance.query('SET LOCAL ROLE ad_maintenance');
      const result = await as('ad_worker', (writer) =>
        pruneAudit(drizzle(maintenance), writer, { now: new Date() }),
      );
      await maintenance.query('COMMIT');
      expect(result.deleted).toBe(1);
    } finally {
      maintenance.release();
    }
    const purge = await t.pool.query("select count(*)::int as n from audit_log where action = 'audit.retention.purge'");
    expect(purge.rows[0].n).toBe(1);
  });
});
