import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDatabase, integrationEnabled, makeAccount, type TestDatabase } from '@ad/db/testing';
import { DbStore } from './db-store';

describe.skipIf(!integrationEnabled())('DbStore', () => {
  let t: TestDatabase;
  let editor: { accountId: string; role: 'editor' };
  let admin: { accountId: string; role: 'admin' };
  beforeAll(async () => {
    t = await createTestDatabase();
    for (const [a, role] of [[makeAccount(), 'editor'], [makeAccount(), 'admin']] as const) {
      await t.pool.query(
        'INSERT INTO accounts (id, email_hash, email_enc, password_hash, role) VALUES ($1,$2,$3,$4,$5)',
        [a.id, a.emailHash, a.emailEnc, a.passwordHash, role],
      );
      if (role === 'editor') editor = { accountId: a.id, role };
      else admin = { accountId: a.id, role };
    }
  });
  afterAll(async () => t?.drop());

  it('saves, lists and approves rows and keeps plural text as an object', async () => {
    const store = new DbStore(t.db, editor);
    await store.upsert('ha', { key: 'player.count', text: { one: '{count} bidiyo', other: '{count} bidiyo' }, status: 'draft', sourceHash: 'ab'.repeat(32), updatedBy: editor.accountId });
    const rows = await store.list('ha');
    expect(rows[0]).toMatchObject({ key: 'player.count', status: 'draft', sourceHash: 'ab'.repeat(32) });
    expect(rows[0]!.text).toEqual({ one: '{count} bidiyo', other: '{count} bidiyo' });
    await new DbStore(t.db, admin).setStatus('ha', 'player.count', 'approved', admin.accountId);
    expect((await new DbStore(t.db).listApproved('ha')).map((r) => r.key)).toEqual(['player.count']);
  });
  it('upsert replaces the text of the same key and resets approval', async () => {
    const store = new DbStore(t.db, editor);
    await store.upsert('ha', { key: 'player.count', text: { one: 'a', other: 'b' }, status: 'draft', sourceHash: null, updatedBy: editor.accountId });
    const rows = await store.list('ha');
    expect(rows).toHaveLength(1);
    expect(rows[0]!.status).toBe('draft');
    expect(await new DbStore(t.db).listApproved('ha')).toHaveLength(0);
  });
});
