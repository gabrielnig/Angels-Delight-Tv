import { createTestDatabase, integrationEnabled, type TestDatabase } from '@ad/db/testing';
import { schema } from '@ad/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AuditWriter } from './audit';

describe.skipIf(!integrationEnabled())('AuditWriter', () => {
  let database: TestDatabase;

  beforeAll(async () => {
    database = await createTestDatabase();
  });
  afterAll(async () => {
    await database.drop();
  });

  it('writes an append only row with the actor, outcome and truncated ip', async () => {
    const audit = new AuditWriter(database.db);
    await audit.record({
      action: 'auth.login',
      outcome: 'success',
      actorAccountId: '0194d3c0-0000-7000-8000-000000000001',
      actorRole: 'viewer',
      ipTrunc: '203.0.113.0/24',
      requestId: 'req-1',
      metadata: { method: 'password' },
    });
    const rows = await database.db.select().from(schema.auditLog);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      action: 'auth.login',
      outcome: 'success',
      actorRole: 'viewer',
      ipTrunc: '203.0.113.0/24',
      requestId: 'req-1',
    });
  });

  it('strips fields that could carry personal data or secrets from the metadata', async () => {
    const audit = new AuditWriter(database.db);
    await audit.record({
      action: 'auth.password_changed',
      outcome: 'success',
      metadata: {
        email: 'a@b.co',
        password: 'x',
        token: 't',
        reason: 'user',
        nested: { secret: 's' },
      },
    });
    const rows = await database.db.select().from(schema.auditLog);
    const row = rows.find((r) => r.action === 'auth.password_changed');
    expect(row?.metadata).toEqual({ reason: 'user' });
  });

  it('never throws when the database write fails, so a login does not fail on logging', async () => {
    const failures: unknown[] = [];
    const audit = new AuditWriter(
      { insert: () => ({ values: () => Promise.reject(new Error('down')) }) } as never,
      { onError: (error) => failures.push(error) },
    );
    await expect(
      audit.record({ action: 'auth.login', outcome: 'failure' }),
    ).resolves.toBeUndefined();
    expect(failures).toHaveLength(1);
  });

  it('rejects update and delete through the database trigger', async () => {
    const audit = new AuditWriter(database.db);
    await audit.record({ action: 'auth.logout', outcome: 'success' });
    await expect(
      database.pool.query('UPDATE audit_log SET outcome = $1', ['failure']),
    ).rejects.toThrow();
    await expect(database.pool.query('DELETE FROM audit_log')).rejects.toThrow();
  });
});
