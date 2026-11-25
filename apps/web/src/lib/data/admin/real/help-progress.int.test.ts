import { schema } from '@ad/db';
import {
  createTestDatabase,
  integrationEnabled,
  makeAccount,
  type TestDatabase,
} from '@ad/db/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setAdminRuntime } from '@/server/admin/runtime';
import { realHelpProgress as s } from './help-progress';

describe.skipIf(!integrationEnabled())('real help progress', () => {
  let t: TestDatabase;
  const accounts = [makeAccount({ role: 'editor' }), makeAccount({ role: 'editor' })];
  const actor = (i: number) => ({ accountId: accounts[i]!.id, role: 'editor' as const, name: 'X' });
  beforeAll(async () => {
    t = await createTestDatabase();
    await t.db.insert(schema.accounts).values(accounts);
    setAdminRuntime({ db: () => t.db });
  });
  afterAll(async () => {
    setAdminRuntime(null);
    await t?.drop();
  });

  it('saves done, watched and helpful on one row and reads them back for that account only', async () => {
    await s.setGuideDone(actor(0), 'D02', true);
    await s.markVideoWatched(actor(0), 'D02');
    await s.setHelpful(actor(0), 'D02', false);
    await s.setHelpful(actor(0), 'D02', true);
    expect(await s.read(actor(0))).toEqual({ D02: { done: true, watched: true, helpful: true } });
    expect(await s.read(actor(1))).toEqual({});
    await s.setGuideDone(actor(0), 'D02', false);
    expect((await s.read(actor(0))).D02?.done).toBe(false);
  });

  it('refuses a bad guide id', async () => {
    await expect(s.setGuideDone(actor(0), 'nope', true)).rejects.toThrow(/guide id/);
  });
});
