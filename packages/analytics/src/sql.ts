import type { SQL } from 'drizzle-orm';

/** The part of a Drizzle database the services need, so they run on a pool, a transaction or a test double. */
export interface SqlExecutor {
  execute(query: SQL): PromiseLike<unknown>;
}

/** node-postgres returns `{ rows }`. Other drivers return the array itself. */
export function rowsOf<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  const rows = (result as { rows?: unknown } | null)?.rows;
  return Array.isArray(rows) ? (rows as T[]) : [];
}
