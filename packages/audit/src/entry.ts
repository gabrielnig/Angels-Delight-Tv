import { truncateIp } from '@ad/security';
import { diffChanges, redact } from './redact';

export type AuditOutcome = 'success' | 'denied' | 'failure';
const OUTCOMES: readonly string[] = ['success', 'denied', 'failure'];
/** Namespaced, lowercase: `video.publish`, `auth.login.failed`. */
const ACTION = /^[a-z][a-z0-9_]*(\.[a-z0-9_]+)+$/;
const MAX_METADATA_BYTES = 8000;
const MAX_USER_AGENT = 160;

export class AuditEntryInvalid extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuditEntryInvalid';
  }
}

export interface AuditEntry {
  action: string;
  outcome: AuditOutcome;
  actorAccountId?: string | null;
  actorRole?: string | null;
  targetType?: string | null;
  targetId?: string | null;
  /** The raw caller address. Only the truncated form is stored. */
  ip?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
  /** One readable line for the log screen, for example "Published How Plants Make Food". */
  summary?: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  /** Extra per action fields. Redacted like everything else. */
  extra?: Record<string, unknown>;
}

export interface AuditRow {
  action: string;
  outcome: AuditOutcome;
  actorAccountId: string | null;
  actorRole: string | null;
  targetType: string | null;
  targetId: string | null;
  ipTrunc: string | null;
  requestId: string | null;
  metadata: Record<string, unknown>;
}

/** Validates an entry and builds the row to insert. Pure, so it is easy to test. */
export function buildAuditRow(entry: AuditEntry): AuditRow {
  if (!ACTION.test(entry.action)) throw new AuditEntryInvalid(`Bad audit action: ${entry.action}`);
  if (!OUTCOMES.includes(entry.outcome)) throw new AuditEntryInvalid('Bad audit outcome');

  const metadata: Record<string, unknown> = {};
  if (entry.extra) Object.assign(metadata, redact(entry.extra));
  if (entry.summary) metadata.summary = String(redact(entry.summary));
  if (entry.before !== undefined || entry.after !== undefined) {
    const changes = diffChanges(entry.before, entry.after);
    metadata.before = changes.before;
    metadata.after = changes.after;
  }
  if (entry.userAgent) metadata.userAgent = entry.userAgent.slice(0, MAX_USER_AGENT);

  if (JSON.stringify(metadata).length > MAX_METADATA_BYTES) {
    delete metadata.before;
    delete metadata.after;
    delete metadata.extra;
    metadata.truncated = true;
  }

  return {
    action: entry.action,
    outcome: entry.outcome,
    actorAccountId: entry.actorAccountId ?? null,
    actorRole: entry.actorRole ?? null,
    targetType: entry.targetType ?? null,
    targetId: entry.targetId ?? null,
    ipTrunc: entry.ip ? truncateIp(entry.ip) : null,
    requestId: entry.requestId ?? null,
    metadata,
  };
}
