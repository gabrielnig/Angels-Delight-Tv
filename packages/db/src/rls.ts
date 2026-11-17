import { isUuid, ACCOUNT_ROLES, type Actor } from '@ad/shared';
import { sql, type SQL } from 'drizzle-orm';

/** The part of a Drizzle database that withAccount needs, so it can be tested with a fake. */
export interface TransactionalDb<Tx extends { execute(query: SQL): PromiseLike<unknown> }> {
  transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T>;
}

/**
 * Runs `fn` in a transaction whose row level security context is the given actor.
 * set_config(..., true) is transaction scoped, so the context cannot leak to the next user of a pooled connection.
 */
export async function withAccount<Tx extends { execute(query: SQL): PromiseLike<unknown> }, T>(
  db: TransactionalDb<Tx>,
  actor: Actor,
  fn: (tx: Tx) => Promise<T>,
): Promise<T> {
  if (!isUuid(actor.accountId)) {
    throw new Error('withAccount needs a valid account id');
  }
  if (!ACCOUNT_ROLES.includes(actor.role)) {
    throw new Error(`withAccount got an unknown role: ${String(actor.role)}`);
  }
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select set_config('app.account_id', ${actor.accountId}, true), set_config('app.actor_role', ${actor.role}, true)`,
    );
    return fn(tx);
  });
}
