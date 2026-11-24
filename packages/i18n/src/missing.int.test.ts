import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDatabase, integrationEnabled, makeAccount, type TestDatabase } from '@ad/db/testing';
import { DbMissingStore } from './missing';

describe.skipIf(!integrationEnabled())('DbMissingStore', () => {
  let t: TestDatabase;
  let admin: { accountId: string; role: 'admin' };
  beforeAll(async () => {
    t = await createTestDatabase();
    const a = makeAccount();
    await t.pool.query('INSERT INTO accounts (id, email_hash, email_enc, password_hash, role) VALUES ($1,$2,$3,$4,$5)', [a.id, a.emailHash, a.emailEnc, a.passwordHash, 'admin']);
    admin = { accountId: a.id, role: 'admin' };
  });
  afterAll(async () => t?.drop());

  it('flush increments hits and updates last_seen, and the report sorts by hits', async () => {
    const store = new DbMissingStore(t.db);
    await store.flush([{ locale: 'yo', key: 'nav.home', hits: 2 }, { locale: 'yo', key: 'nav.browse', hits: 5 }]);
    await store.flush([{ locale: 'yo', key: 'nav.home', hits: 4 }]);
    const report = await new DbMissingStore(t.db, admin).list('yo');
    expect(report.map((r) => [r.key, r.hits])).toEqual([['nav.home', 6], ['nav.browse', 5]]);
    expect(report[0]!.lastSeen).toBeInstanceOf(Date);
  });
});
