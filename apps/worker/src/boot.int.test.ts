import { createLogger } from '@ad/shared';
import { createTestDatabase, integrationEnabled, type TestDatabase } from '@ad/db/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bootWorker } from './boot';

describe.skipIf(!integrationEnabled())('worker boot against a real database', () => {
  let t: TestDatabase;

  beforeAll(async () => {
    t = await createTestDatabase();
  });
  afterAll(async () => {
    await t?.drop();
  });

  it('starts pg-boss, installs its schema and stops cleanly', async () => {
    const lines: string[] = [];
    const logger = createLogger({ write: (line) => lines.push(line) });
    const worker = await bootWorker({
      env: { DATABASE_URL_WORKER: t.url, NODE_ENV: 'test' },
      logger,
    });

    const schema = await t.pool.query(
      "SELECT 1 FROM pg_tables WHERE schemaname = 'pgboss' AND tablename = 'job'",
    );
    expect(schema.rowCount).toBeGreaterThan(0);

    await worker.stop();
    expect(lines.some((line) => line.includes('worker stopped'))).toBe(true);
  });

  it('boots as the restricted ad_worker role, and the web role can then reach the queue tables', async () => {
    const own = await createTestDatabase();
    const asWorker = new URL(own.url);
    asWorker.searchParams.set('options', '-c role=ad_worker');
    const logger = createLogger({ write: () => undefined });
    const worker = await bootWorker({
      env: { DATABASE_URL_WORKER: asWorker.toString(), NODE_ENV: 'test' },
      logger,
    });
    await worker.stop();

    const client = await own.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SET LOCAL ROLE ad_app');
      const result = await client.query('SELECT count(*)::int AS n FROM pgboss.job');
      expect(result.rows[0].n).toBe(0);
      await client.query('ROLLBACK');
    } finally {
      client.release();
      await own.drop();
    }
  });
});
