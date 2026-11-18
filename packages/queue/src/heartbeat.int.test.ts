import { createTestDatabase, integrationEnabled, type TestDatabase } from '@ad/db/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DrizzleHeartbeatStore } from './heartbeat';

describe.skipIf(!integrationEnabled())('worker heartbeat store', () => {
  let t: TestDatabase;
  beforeAll(async () => {
    t = await createTestDatabase();
  });
  afterAll(async () => {
    await t.drop();
  });

  it('reads null before the first beat, then the newest beat', async () => {
    const store = new DrizzleHeartbeatStore(t.db);
    expect(await store.last('worker')).toBeNull();
    await store.beat('worker');
    const first = await store.last('worker');
    expect(first).toBeInstanceOf(Date);
    expect(Date.now() - first!.getTime()).toBeLessThan(5_000);
    await new Promise((r) => setTimeout(r, 20));
    await store.beat('worker');
    expect((await store.last('worker'))!.getTime()).toBeGreaterThan(first!.getTime());
  });
});
