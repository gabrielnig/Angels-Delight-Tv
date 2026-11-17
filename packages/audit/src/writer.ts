import { schema, type Database } from '@ad/db';
import { buildAuditRow, type AuditEntry } from './entry';

type Insertable = Pick<Database, 'insert'>;

export class AuditWriteError extends Error {
  constructor(options?: { cause?: unknown }) {
    super('Could not write the audit entry', options);
    this.name = 'AuditWriteError';
  }
}

/**
 * Appends one entry and throws if it cannot. Call it inside the transaction of the action it describes,
 * so a failed write rolls the action back (M20-S01 AC3).
 */
export async function writeAudit(db: Insertable, entry: AuditEntry): Promise<void> {
  const row = buildAuditRow(entry);
  try {
    await db.insert(schema.auditLog).values(row);
  } catch (error) {
    throw new AuditWriteError({ cause: error });
  }
}

interface TransactionalDb<Tx extends Insertable> {
  transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T>;
}

/**
 * Runs an admin write and its audit entry in one transaction. The entry is built from the result, so it can
 * name the new id. Either both commit or neither does.
 */
export async function withAudit<Tx extends Insertable, T>(
  db: TransactionalDb<Tx>,
  work: (tx: Tx) => Promise<T>,
  entryFor: (result: T) => AuditEntry,
): Promise<T> {
  return db.transaction(async (tx) => {
    const result = await work(tx);
    await writeAudit(tx, entryFor(result));
    return result;
  });
}

/**
 * Best effort write for events that happen outside an admin transaction, such as a denied request or a viewer
 * password change. A failure is reported to `onError` and swallowed.
 */
export async function recordAudit(
  db: Insertable,
  entry: AuditEntry,
  onError: (error: unknown) => void = () => undefined,
): Promise<void> {
  try {
    await writeAudit(db, entry);
  } catch (error) {
    onError(error);
  }
}
