import { createTestDatabase, integrationEnabled, type TestDatabase } from '@ad/db/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DbUsageStore } from './usage';

describe.skipIf(!integrationEnabled())('DbUsageStore against Postgres', () => {
  let t: TestDatabase;
  beforeAll(async () => {
    t = await createTestDatabase();
  });
  afterAll(async () => {
    await t.drop();
  });

  it('starts at zero and adds across calls for the same month and provider', async () => {
    const store = new DbUsageStore(t.db);
    expect(await store.used('2026-11-01', 'google')).toBe(0);
    await store.add('2026-11-01', 'google', 120);
    await store.add('2026-11-01', 'google', 30);
    expect(await store.used('2026-11-01', 'google')).toBe(150);
  });
  it('keeps months and providers apart', async () => {
    const store = new DbUsageStore(t.db);
    await store.add('2026-12-01', 'google', 5);
    expect(await store.used('2026-12-01', 'llm')).toBe(0);
    expect(await store.used('2026-10-01', 'google')).toBe(0);
  });
});
