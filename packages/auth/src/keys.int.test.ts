import { uuidv7 } from '@ad/shared';
import { integrationEnabled } from '@ad/db/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { KeyService, KeyUnavailable } from './keys';
import { createAuthTestDatabases, type AuthTestDatabases } from './testing';

const kek = new Uint8Array(32).fill(3);
const otherKek = new Uint8Array(32).fill(4);

describe.skipIf(!integrationEnabled())('KeyService', () => {
  let dbs: AuthTestDatabases;

  beforeAll(async () => {
    dbs = await createAuthTestDatabases();
  });
  afterAll(async () => {
    await dbs.drop();
  });

  const service = (overrides: Partial<ConstructorParameters<typeof KeyService>[0]> = {}) =>
    new KeyService({ keysDb: dbs.keys.db, shredDb: dbs.shred.db, kek, ...overrides });

  it('stores only a wrapped key and returns the same key on later reads', async () => {
    const accountId = uuidv7();
    const keys = service();
    const dek = await keys.createForAccount(accountId);
    expect(dek).toHaveLength(32);
    const rows = await dbs.admin.keysPool.query('SELECT dek_wrapped FROM user_keys WHERE account_id = $1', [accountId]);
    const wrapped = rows.rows[0].dek_wrapped as Buffer;
    expect(wrapped.length).toBeGreaterThan(32);
    expect(wrapped.includes(Buffer.from(dek))).toBe(false);
    expect(Buffer.from(await service().get(accountId)).equals(Buffer.from(dek))).toBe(true);
  });

  it('seals and opens a value bound to the account and column', async () => {
    const accountId = uuidv7();
    const keys = service();
    await keys.createForAccount(accountId);
    const sealed = await keys.seal(accountId, 'email', 'tobi@example.com');
    expect(await keys.open(accountId, 'email', sealed)).toBe('tobi@example.com');
    await expect(keys.open(accountId, 'display_name', sealed)).rejects.toThrow();
  });

  it('does not open one account value with another account key', async () => {
    const a = uuidv7();
    const b = uuidv7();
    const keys = service();
    await keys.createForAccount(a);
    await keys.createForAccount(b);
    const sealed = await keys.seal(a, 'email', 'a@example.com');
    await expect(keys.open(b, 'email', sealed)).rejects.toThrow();
  });

  it('cannot unwrap with the wrong key encryption key', async () => {
    const accountId = uuidv7();
    await service().createForAccount(accountId);
    await expect(service({ kek: otherKek }).get(accountId)).rejects.toThrow();
  });

  it('unwraps with FIELD_KEK_PREVIOUS during a rotation', async () => {
    const accountId = uuidv7();
    const dek = await service({ kek: otherKek }).createForAccount(accountId);
    const rotated = service({ kek, kekPrevious: otherKek });
    expect(Buffer.from(await rotated.get(accountId)).equals(Buffer.from(dek))).toBe(true);
  });

  it('serves reads from memory for five minutes, then goes back to the database', async () => {
    const accountId = uuidv7();
    let now = 0;
    const keys = service({ clock: () => now });
    await keys.createForAccount(accountId);
    await dbs.admin.keysPool.query('DELETE FROM user_keys WHERE account_id = $1', [accountId]);
    now = 4 * 60_000;
    await expect(keys.get(accountId)).resolves.toHaveLength(32);
    now = 5 * 60_000 + 1;
    await expect(keys.get(accountId)).rejects.toBeInstanceOf(KeyUnavailable);
  });

  it('destroy removes the key everywhere and the data can never be opened again', async () => {
    const accountId = uuidv7();
    const keys = service();
    await keys.createForAccount(accountId);
    const sealed = await keys.seal(accountId, 'email', 'gone@example.com');
    expect(await keys.destroy(accountId)).toBe(true);
    await expect(keys.get(accountId)).rejects.toBeInstanceOf(KeyUnavailable);
    await expect(service().open(accountId, 'email', sealed)).rejects.toBeInstanceOf(KeyUnavailable);
  });

  it('destroy is idempotent and reports false when nothing was left to delete', async () => {
    const keys = service();
    expect(await keys.destroy(uuidv7())).toBe(false);
  });

  it('refuses to destroy without a shred connection', async () => {
    const keys = service({ shredDb: undefined });
    await expect(keys.destroy(uuidv7())).rejects.toThrow(/shred/i);
  });

  it('the app role can create and read keys but not delete them', async () => {
    const accountId = uuidv7();
    await service().createForAccount(accountId);
    await expect(
      dbs.keys.pool.query('DELETE FROM user_keys WHERE account_id = $1', [accountId]),
    ).rejects.toThrow(/permission denied/);
  });
});
