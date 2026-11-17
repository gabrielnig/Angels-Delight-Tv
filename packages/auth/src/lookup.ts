import type { Database } from '@ad/db';
import type { AccountRole, AccountStatus } from '@ad/shared';
import { sql } from 'drizzle-orm';

export interface FoundAccount {
  id: string;
  passwordHash: string | null;
  status: AccountStatus;
  role: AccountRole;
}

interface FoundRow extends Record<string, unknown> {
  id: string;
  password_hash: string | null;
  status: AccountStatus;
  role: AccountRole;
}

/** Pre sign in lookup through the SECURITY DEFINER function, since the app role has no blanket read on accounts. */
export async function findAccountByEmailHash(
  db: Pick<Database, 'execute'>,
  hash: Uint8Array,
): Promise<FoundAccount | null> {
  const result = await db.execute<FoundRow>(
    sql`SELECT * FROM auth_find_account(${Buffer.from(hash)})`,
  );
  const row = result.rows[0];
  return row
    ? { id: row.id, passwordHash: row.password_hash, status: row.status, role: row.role }
    : null;
}

export function isUniqueViolation(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 4 && current; depth++) {
    if ((current as { code?: string }).code === '23505') return true;
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}
