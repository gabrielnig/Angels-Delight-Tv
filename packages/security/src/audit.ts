import { schema, type Database } from '@ad/db';

export type AuditOutcome = 'success' | 'denied' | 'failure';

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

/** Anything that looks like personal data or a credential is dropped from the free-form metadata. */
const FORBIDDEN_KEY = /email|password|token|secret|code|cookie|authorization|hash|key/i;

export function sanitizeMetadata(metadata: Record<string, unknown> = {}): Record<string, unknown> {
  const clean: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(metadata)) {
    if (FORBIDDEN_KEY.test(name)) continue;
    if (value !== null && typeof value === 'object') {
      if (Array.isArray(value)) continue;
      const nested = sanitizeMetadata(value as Record<string, unknown>);
      if (Object.keys(nested).length > 0) clean[name] = nested;
      continue;
    }
    clean[name] = value;
  }
  return clean;
}

export interface AuditWriterOptions {
  onError?: (error: unknown) => void;
}

type AuditDb = Pick<Database, 'insert'>;

/**
 * Appends security events to `audit_log` (SECURITY.md section 15). A failed write is reported to `onError`
 * and swallowed, so a logging fault never blocks a sign in or turns into a 500.
 */
export class AuditWriter {
  private readonly onError: (error: unknown) => void;

  constructor(
    private readonly db: AuditDb,
    options: AuditWriterOptions = {},
  ) {
    this.onError = options.onError ?? (() => undefined);
  }

  async record(event: AuditEvent): Promise<void> {
    try {
      await this.db.insert(schema.auditLog).values({
        action: event.action,
        outcome: event.outcome,
        actorAccountId: event.actorAccountId ?? null,
        actorRole: event.actorRole ?? null,
        targetType: event.targetType ?? null,
        targetId: event.targetId ?? null,
        ipTrunc: event.ipTrunc ?? null,
        requestId: event.requestId ?? null,
        metadata: sanitizeMetadata(event.metadata),
      });
    } catch (error) {
      this.onError(error);
    }
  }
}
