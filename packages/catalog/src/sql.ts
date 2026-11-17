import { sql, type SQL } from 'drizzle-orm';

const ALIAS = /^[a-z][a-z_]{0,15}$/;

/** A table alias used inside a raw SQL fragment. Only internal constants are passed in, the check guards against slips. */
export function alias(name: string): SQL {
  if (!ALIAS.test(name)) throw new Error(`Invalid SQL alias: ${name}`);
  return sql.raw(name);
}

export function uuidList(ids: readonly string[]): SQL {
  if (ids.length === 0) return sql`NULL::uuid`;
  return sql.join(
    ids.map((id) => sql`${id}::uuid`),
    sql`, `,
  );
}

export function rowsOf<T>(result: unknown): T[] {
  return (result as { rows: T[] }).rows;
}

export function isoOrNull(value: Date | string | null): string | null {
  if (value === null) return null;
  return value instanceof Date ? value.toISOString() : value;
}
