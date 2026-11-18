import type { Database } from '@ad/db';
import type { AuditOutcome } from './entry';
import { writeAudit } from './writer';

export interface AuditEvent {
  action: string;
  outcome: AuditOutcome;
  actorAccountId?: string | null;
  actorRole?: string | null;
  targetType?: string | null;
  targetId?: string | null;
  ipTrunc?: string | null;
  requestId?: string | null;
  metadata?: Record<string, unknown>;
}

export interface AuditWriterOptions {
  onError?: (error: unknown) => void;
}

/**
 * Best effort writer for security events outside an admin transaction (sign in, lockout, password change).
 * It uses the same entry validation and redaction as admin entries, and a failed write is reported to `onError`
 * and swallowed so a logging fault never blocks a sign in or turns into a 500.
 */
export class AuditWriter {
  private readonly onError: (error: unknown) => void;

  constructor(
    private readonly db: Pick<Database, 'insert'>,
    options: AuditWriterOptions = {},
  ) {
    this.onError = options.onError ?? (() => undefined);
  }

  async record(event: AuditEvent): Promise<void> {
    try {
      const { metadata, ...rest } = event;
      await writeAudit(this.db, { ...rest, extra: metadata });
    } catch (error) {
      this.onError(error);
    }
  }
}
