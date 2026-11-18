import { createTestDatabase, integrationEnabled, type TestDatabase } from '@ad/db/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createSuppressionStore } from './suppression';

const pepper = new Uint8Array(32).fill(7);

describe.skipIf(!integrationEnabled())('suppression store', () => {
  let database: TestDatabase;
  beforeAll(async () => {
    database = await createTestDatabase();
  });
  afterAll(async () => {
    await database.drop();
  });

  it('flags an address regardless of case and spacing, and stores no address', async () => {
    const store = createSuppressionStore(database.db, pepper);
    expect(await store.isSuppressed('Gone@Example.com')).toBe(false);
    await store.suppress(' Gone@Example.com ', 'bounce');
    expect(await store.isSuppressed('gone@example.com')).toBe(true);
    expect(await store.isSuppressed('other@example.com')).toBe(false);
    const rows = await database.pool.query('select * from email_suppressions');
    expect(JSON.stringify(rows.rows)).not.toContain('example.com');
  });

  it('suppressing twice is harmless and an unusable address is ignored', async () => {
    const store = createSuppressionStore(database.db, pepper);
    await store.suppress('twice@example.com', 'bounce');
    await store.suppress('twice@example.com', 'complaint');
    expect(await store.isSuppressed('twice@example.com')).toBe(true);
    await expect(store.suppress('not an address', 'bounce')).resolves.toBeUndefined();
  });
});
