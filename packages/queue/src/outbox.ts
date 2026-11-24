import { randomUUID } from 'node:crypto';
import { emailOutbox, type Database } from '@ad/db';
import { decryptAesGcm, encryptAesGcm } from '@ad/shared';
import { sql } from 'drizzle-orm';
import { signUnsubscribeToken } from './unsubscribe-token';

/**
 * The email outbox (M15-S01, M21-S03). Notification and export mail is written here and sent by the worker, so a
 * slow or failing provider never holds up a request or a job, and a failed send is retried with growing waits.
 * Sign in and account mail stays out of it (D-129): it needs the answer inside the request.
 */

export type OutboxKind =
  | 'staff_notice'
  | 'staff_summary'
  | 'staff_export_ready'
  | 'staff_export_failed'
  | 'viewer_digest_daily'
  | 'viewer_digest_weekly';

export type OutboxVars = Record<string, string | number>;

/** The sending side, as the worker's Mailer provides it. Each call returns the provider message id. */
export interface OutboxMailer {
  sendStaffNotice(input: {
    to: string;
    title: string;
    body?: string;
  }): Promise<{ messageId: string } | null>;
  sendStaffSummary(input: {
    to: string;
    period: 'hour' | 'day';
    lines: string[];
  }): Promise<{ messageId: string } | null>;
  sendStaffExportReady(input: {
    to: string;
    name: string;
    rows: number;
    hours: number;
  }): Promise<{ messageId: string } | null>;
  sendStaffExportFailed(input: { to: string; name: string }): Promise<{ messageId: string } | null>;
  sendViewerDigest(input: {
    to: string;
    period: 'day' | 'week';
    lines: string[];
    unsubscribeToken: string;
  }): Promise<{ messageId: string } | null>;
}

const enc = new TextEncoder();
const dec = new TextDecoder();

/** Seals an address with the field key. The scope binds the value to its row, so a copy elsewhere cannot be opened. */
export function sealAddress(kek: Uint8Array, scope: string, address: string): Buffer {
  return Buffer.from(encryptAesGcm(kek, enc.encode(address), enc.encode(`addr:${scope}`)));
}

export function openAddress(kek: Uint8Array, scope: string, sealed: Uint8Array): string {
  return dec.decode(decryptAesGcm(kek, new Uint8Array(sealed), enc.encode(`addr:${scope}`)));
}

/** Attempts before a row is given up on. */
export const MAX_SEND_ATTEMPTS = 5;
export const DEFAULT_BATCH_SIZE = 50;
/** A claimed row is handed back to the queue if its worker has not finished within this time. */
export const SEND_LOCK_SECONDS = 300;
export const KEEP_SENT_DAYS = 30;
export const KEEP_FAILED_DAYS = 90;

const BACKOFF_SECONDS = [60, 300, 900, 3600, 10800] as const;

/** Wait after the nth failed attempt: a minute, five, fifteen, an hour, three hours. */
export function backoffSeconds(attempt: number): number {
  return BACKOFF_SECONDS[Math.min(Math.max(attempt, 1), BACKOFF_SECONDS.length) - 1]!;
}

function responseCode(error: unknown, depth = 0): number | null {
  if (!error || typeof error !== 'object' || depth > 3) return null;
  const code = (error as { responseCode?: unknown }).responseCode;
  if (typeof code === 'number') return code;
  return responseCode((error as { cause?: unknown }).cause, depth + 1);
}

/** An SMTP 5xx reply, or a template that cannot render, will not get better by waiting. */
export function isPermanentSendError(error: unknown): boolean {
  const code = responseCode(error);
  if (code !== null && code >= 500 && code < 600) return true;
  return (
    error instanceof Error &&
    (error.name === 'TemplateError' ||
      error.name === 'AddressUnreadable' ||
      error.name === 'EmailNotConfigured')
  );
}

/** Error text for the row. Addresses are removed and the length is capped, so the log holds no personal data. */
export function describeSendError(error: unknown): string {
  let source: unknown = error;
  while (source instanceof Error && source.cause instanceof Error) source = source.cause;
  const text = source instanceof Error ? source.message : String(source);
  return text.replace(/[^\s@<>"']+@[^\s@<>"']+/g, '[address]').slice(0, 300);
}

function rowsOf<T>(result: unknown): T[] {
  return Array.isArray(result) ? (result as T[]) : (((result as { rows?: T[] }).rows ?? []) as T[]);
}

export interface EnqueueInput {
  kind: OutboxKind;
  to: string;
  vars: OutboxVars;
  recipientId?: string | null;
  /** A second row with the same key is dropped, so a retried producer cannot mail twice. */
  dedupeKey?: string;
  runAt?: Date;
  now?: Date;
}

/** Adds one email to the outbox. Returns the row id, or null when the dedupe key was already used. */
export async function enqueueEmail(
  db: Database,
  kek: Uint8Array,
  input: EnqueueInput,
): Promise<string | null> {
  const id = randomUUID();
  const inserted = await db
    .insert(emailOutbox)
    .values({
      id,
      kind: input.kind,
      recipientId: input.recipientId ?? null,
      toEnc: sealAddress(kek, `outbox:${id}`, input.to),
      vars: input.vars,
      dedupeKey: input.dedupeKey ?? null,
      nextAttemptAt: input.runAt ?? input.now ?? new Date(),
      ...(input.now ? { createdAt: input.now } : {}),
    })
    .onConflictDoNothing()
    .returning({ id: emailOutbox.id });
  return inserted[0]?.id ?? null;
}

export interface DrainDeps {
  db: Database;
  kek: Uint8Array;
  mailer: OutboxMailer;
  now?: Date;
  batchSize?: number;
  maxAttempts?: number;
}

export interface DrainResult {
  claimed: number;
  sent: number;
  retried: number;
  failed: number;
}

interface Claimed {
  id: string;
  kind: OutboxKind;
  to_enc: Buffer;
  vars: OutboxVars;
  attempts: number;
}

function dispatch(
  mailer: OutboxMailer,
  kind: OutboxKind,
  to: string,
  vars: OutboxVars,
  kek: Uint8Array,
  now: Date,
) {
  switch (kind) {
    case 'staff_notice':
      return mailer.sendStaffNotice({
        to,
        title: String(vars.title ?? ''),
        body: vars.body === undefined ? undefined : String(vars.body),
      });
    case 'staff_summary':
      return mailer.sendStaffSummary({
        to,
        period: vars.period === 'day' ? 'day' : 'hour',
        lines: String(vars.lines ?? '').split('\n'),
      });
    case 'staff_export_ready':
      return mailer.sendStaffExportReady({
        to,
        name: String(vars.name ?? ''),
        rows: Number(vars.rows ?? 0),
        hours: Number(vars.hours ?? 24),
      });
    case 'staff_export_failed':
      return mailer.sendStaffExportFailed({ to, name: String(vars.name ?? '') });
    case 'viewer_digest_daily':
    case 'viewer_digest_weekly':
      return mailer.sendViewerDigest({
        to,
        period: kind === 'viewer_digest_weekly' ? 'week' : 'day',
        lines: String(vars.lines ?? '').split('\n'),
        unsubscribeToken: signUnsubscribeToken(kek, String(vars.accountId ?? ''), now),
      });
    default:
      throw Object.assign(new Error(`Unknown outbox kind ${String(kind)}`), {
        name: 'TemplateError',
      });
  }
}

/**
 * Sends one batch of due mail. Rows are claimed with FOR UPDATE SKIP LOCKED and a lock time, so two workers never
 * send the same row, and a row whose worker died is picked up again once the lock runs out.
 */
export async function drainOutbox(deps: DrainDeps): Promise<DrainResult> {
  const { db, kek, mailer } = deps;
  const now = deps.now ?? new Date();
  const batch = deps.batchSize ?? DEFAULT_BATCH_SIZE;
  const max = deps.maxAttempts ?? MAX_SEND_ATTEMPTS;
  const stamp = now.toISOString();

  // A row that kept dying mid send has used its attempts. Close it instead of leaving it locked forever.
  await db.execute(sql`
    UPDATE email_outbox
    SET status = 'failed', locked_until = NULL, last_error = 'gave up: the worker stopped during every attempt'
    WHERE status = 'sending' AND locked_until < ${stamp}::timestamptz AND attempts >= ${max}`);

  const claimed = rowsOf<Claimed>(
    await db.execute(sql`
      WITH due AS (
        SELECT id FROM email_outbox
        WHERE attempts < ${max}
          AND ((status = 'queued' AND next_attempt_at <= ${stamp}::timestamptz)
            OR (status = 'sending' AND locked_until < ${stamp}::timestamptz))
        ORDER BY next_attempt_at, created_at
        LIMIT ${batch}
        FOR UPDATE SKIP LOCKED
      )
      UPDATE email_outbox o
      SET status = 'sending', attempts = o.attempts + 1,
          locked_until = ${stamp}::timestamptz + make_interval(secs => ${SEND_LOCK_SECONDS})
      FROM due WHERE o.id = due.id
      RETURNING o.id, o.kind, o.to_enc, o.vars, o.attempts`),
  );

  const result: DrainResult = { claimed: claimed.length, sent: 0, retried: 0, failed: 0 };
  for (const row of claimed) {
    try {
      let to: string;
      try {
        to = openAddress(kek, `outbox:${row.id}`, row.to_enc);
      } catch {
        throw Object.assign(new Error('the stored address could not be opened'), {
          name: 'AddressUnreadable',
        });
      }
      const sent = await dispatch(mailer, row.kind, to, row.vars, kek, now);
      await db.execute(sql`
        UPDATE email_outbox
        SET status = 'sent', sent_at = ${stamp}::timestamptz, provider_message_id = ${sent?.messageId ?? null},
            last_error = ${sent ? null : 'skipped: address is on the suppression list'}, locked_until = NULL
        WHERE id = ${row.id}`);
      result.sent += 1;
    } catch (error) {
      const text = describeSendError(error);
      const final = isPermanentSendError(error) || row.attempts >= max;
      if (final) {
        await db.execute(sql`
          UPDATE email_outbox SET status = 'failed', last_error = ${text}, locked_until = NULL
          WHERE id = ${row.id}`);
        result.failed += 1;
      } else {
        await db.execute(sql`
          UPDATE email_outbox
          SET status = 'queued', last_error = ${text}, locked_until = NULL,
              next_attempt_at = ${stamp}::timestamptz + make_interval(secs => ${backoffSeconds(row.attempts)})
          WHERE id = ${row.id}`);
        result.retried += 1;
      }
    }
  }
  return result;
}

/** Drops sent rows after 30 days and failed ones after 90, so sealed addresses do not pile up. Returns the count. */
export async function pruneOutbox(db: Database, now: Date = new Date()): Promise<number> {
  const stamp = now.toISOString();
  const removed = rowsOf<{ id: string }>(
    await db.execute(sql`
      DELETE FROM email_outbox
      WHERE (status = 'sent' AND sent_at < ${stamp}::timestamptz - make_interval(days => ${KEEP_SENT_DAYS}))
         OR (status = 'failed' AND created_at < ${stamp}::timestamptz - make_interval(days => ${KEEP_FAILED_DAYS}))
      RETURNING id`),
  );
  return removed.length;
}
