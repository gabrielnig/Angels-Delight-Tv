import type { SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';
import { withAccount, type TransactionalDb } from './rls';

const dialect = new PgDialect();

interface Recorded {
  statements: { text: string; params: unknown[] }[];
  committed: boolean;
  rolledBack: boolean;
}

function fakeDb(): {
  db: TransactionalDb<{ execute: (query: unknown) => Promise<unknown> }>;
  log: Recorded;
} {
  const log: Recorded = { statements: [], committed: false, rolledBack: false };
  const db = {
    async transaction<T>(
      fn: (tx: { execute: (query: unknown) => Promise<unknown> }) => Promise<T>,
    ): Promise<T> {
      const tx = {
        execute: async (query: unknown) => {
          const rendered = dialect.sqlToQuery(query as SQL);
          log.statements.push({ text: rendered.sql, params: rendered.params });
          return [];
        },
      };
      try {
        const result = await fn(tx);
        log.committed = true;
        return result;
      } catch (error) {
        log.rolledBack = true;
        throw error;
      }
    },
  };
  return { db, log };
}

const accountId = '0190e8e0-0000-7000-8000-000000000001';

describe('withAccount', () => {
  it('sets the account and role context before running the callback', async () => {
    const { db, log } = fakeDb();
    const seen: number[] = [];
    await withAccount(db, { accountId, role: 'viewer' }, async () => {
      seen.push(log.statements.length);
    });
    expect(seen).toEqual([1]);
    expect(log.statements[0]?.text).toContain('app.account_id');
    expect(log.statements[0]?.text).toContain('app.actor_role');
    expect(log.statements[0]?.text).toContain('true');
  });

  it('passes the identity as bound parameters, never inlined into the SQL text', async () => {
    const { db, log } = fakeDb();
    await withAccount(db, { accountId, role: 'admin' }, async () => undefined);
    expect(log.statements[0]?.text).not.toContain(accountId);
    expect(log.statements[0]?.params).toEqual([accountId, 'admin']);
  });

  it('returns what the callback returns and commits', async () => {
    const { db, log } = fakeDb();
    const value = await withAccount(db, { accountId, role: 'editor' }, async () => 42);
    expect(value).toBe(42);
    expect(log.committed).toBe(true);
  });

  it('rolls back and rethrows when the callback fails', async () => {
    const { db, log } = fakeDb();
    await expect(
      withAccount(db, { accountId, role: 'viewer' }, async () => {
        throw new Error('write failed');
      }),
    ).rejects.toThrow('write failed');
    expect(log.rolledBack).toBe(true);
  });

  it('rejects an account id that is not a uuid before opening a transaction', async () => {
    const { db, log } = fakeDb();
    await expect(
      withAccount(db, { accountId: "x'; drop table accounts;--", role: 'viewer' }, async () => 1),
    ).rejects.toThrow(/account id/i);
    expect(log.statements).toHaveLength(0);
  });

  it('rejects a role outside the known roles', async () => {
    const { db } = fakeDb();
    await expect(
      withAccount(db, { accountId, role: 'root' as never }, async () => 1),
    ).rejects.toThrow(/role/i);
  });
});
