import { createTestDatabase, integrationEnabled, type TestDatabase } from '@ad/db/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { LockoutStore } from './lockout';

const policy = { maxFailures: 5, windowSeconds: 900, lockSeconds: 900 };

describe.skipIf(!integrationEnabled())('LockoutStore', () => {
  let database: TestDatabase;
  let now = new Date('2026-01-01T00:00:00Z');
  const clock = () => now;
  const at = (seconds: number) => {
    now = new Date(new Date('2026-01-01T00:00:00Z').getTime() + seconds * 1000);
  };

  beforeAll(async () => {
    database = await createTestDatabase();
  });
  afterAll(async () => {
    await database.drop();
  });

  it('locks on the fifth failure and reports that the lock just started', async () => {
    at(0);
    const store = new LockoutStore(database.db, { clock });
    const outcomes = [];
    for (let i = 0; i < 5; i++) outcomes.push(await store.registerFailure('acct:1', policy));
    expect(outcomes.map((o) => o.locked)).toEqual([false, false, false, false, true]);
    expect(outcomes[4]?.justLocked).toBe(true);
    expect(outcomes[4]?.retryAfterSeconds).toBe(900);
  });

  it('refuses while locked and counts the remaining wait rounded up', async () => {
    at(0);
    const store = new LockoutStore(database.db, { clock });
    for (let i = 0; i < 5; i++) await store.registerFailure('acct:2', policy);
    at(61);
    const status = await store.status('acct:2');
    expect(status.locked).toBe(true);
    expect(status.retryAfterSeconds).toBe(839);
  });

  it('a failure during a lock does not extend it or restart justLocked', async () => {
    at(0);
    const store = new LockoutStore(database.db, { clock });
    for (let i = 0; i < 5; i++) await store.registerFailure('acct:3', policy);
    at(100);
    const again = await store.registerFailure('acct:3', policy);
    expect(again.locked).toBe(true);
    expect(again.justLocked).toBe(false);
    expect(again.retryAfterSeconds).toBe(800);
  });

  it('unlocks after the lock time and starts counting from zero', async () => {
    at(0);
    const store = new LockoutStore(database.db, { clock });
    for (let i = 0; i < 5; i++) await store.registerFailure('acct:4', policy);
    at(901);
    expect((await store.status('acct:4')).locked).toBe(false);
    const next = await store.registerFailure('acct:4', policy);
    expect(next.failures).toBe(1);
    expect(next.locked).toBe(false);
  });

  it('forgets old failures once the window has passed', async () => {
    at(0);
    const store = new LockoutStore(database.db, { clock });
    for (let i = 0; i < 4; i++) await store.registerFailure('acct:5', policy);
    at(901);
    const next = await store.registerFailure('acct:5', policy);
    expect(next.failures).toBe(1);
  });

  it('clear resets the counter and lifts a lock', async () => {
    at(0);
    const store = new LockoutStore(database.db, { clock });
    for (let i = 0; i < 5; i++) await store.registerFailure('acct:6', policy);
    await store.clear('acct:6');
    expect((await store.status('acct:6')).locked).toBe(false);
    expect((await store.registerFailure('acct:6', policy)).failures).toBe(1);
  });

  it('counts concurrent failures without losing any', async () => {
    at(0);
    const store = new LockoutStore(database.db, { clock });
    await Promise.all(Array.from({ length: 4 }, () => store.registerFailure('acct:7', policy)));
    expect((await store.registerFailure('acct:7', policy)).failures).toBe(5);
  });
});
