import { adminNotices, type Database } from '@ad/db';
import { inArray, sql } from 'drizzle-orm';
import { enqueueEmail, openAddress, sealAddress } from './outbox';

/**
 * Notification email for staff (M21-S03). Each person picks when it arrives: at once, in an hourly summary or in
 * one daily summary at 07:00 Lagos time. Which notices count follows their other choices: failures, captions
 * ready, and the extra daily summary of everything. The worker reads only these tables, never `accounts`.
 */

export const DIGEST_TIMEZONE = 'Africa/Lagos';
export const DAILY_SUMMARY_HOUR = 7;
/** Notices older than this are not worth an email any more. */
export const PENDING_KEEP_DAYS = 7;
export const MAX_SUMMARY_LINES = 50;

const FAILURE_KINDS = ['encode_failed', 'captions_failed'] as const;
const READY_KINDS = ['captions_ready'] as const;

export function sealPrefsAddress(kek: Uint8Array, accountId: string, address: string): Buffer {
  return sealAddress(kek, `prefs:${accountId}`, address);
}

function openPrefsAddress(kek: Uint8Array, accountId: string, sealed: Uint8Array): string {
  return openAddress(kek, `prefs:${accountId}`, sealed);
}

function lagosParts(now: Date): { date: string; hour: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: DIGEST_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const pick = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return { date: `${pick('year')}-${pick('month')}-${pick('day')}`, hour: Number(pick('hour')) };
}

/** True during the Lagos hour that starts at 07:00, when daily summaries go out. */
export function isDailySummaryHour(now: Date): boolean {
  return lagosParts(now).hour === DAILY_SUMMARY_HOUR;
}

function rowsOf<T>(result: unknown): T[] {
  return Array.isArray(result) ? (result as T[]) : (((result as { rows?: T[] }).rows ?? []) as T[]);
}

interface NoticeRow {
  id: string;
  recipient_id: string;
  kind: string;
  title: string;
  body: string;
  created_at: Date;
  email_frequency: 'immediate' | 'hourly' | 'daily';
  daily_summary: boolean;
  address_enc: Buffer | null;
}

const failureKinds = sql.join(
  FAILURE_KINDS.map((k) => sql`${k}`),
  sql`, `,
);
const readyKinds = sql.join(
  READY_KINDS.map((k) => sql`${k}`),
  sql`, `,
);

/** Notices not yet emailed that the person's own choices say they want by email. */
async function pendingNotices(db: Database, now: Date): Promise<NoticeRow[]> {
  const stamp = now.toISOString();
  return rowsOf<NoticeRow>(
    await db.execute(sql`
      SELECT n.id, n.recipient_id, n.kind, n.title, n.body, n.created_at,
             p.email_frequency, p.daily_summary, p.address_enc
      FROM admin_notices n
      JOIN staff_notification_prefs p ON p.account_id = n.recipient_id
      WHERE n.emailed_at IS NULL
        AND n.created_at <= ${stamp}::timestamptz
        AND n.created_at > ${stamp}::timestamptz - make_interval(days => ${PENDING_KEEP_DAYS})
        AND ((p.failures AND n.kind IN (${failureKinds})) OR (p.captions_ready AND n.kind IN (${readyKinds})))
      ORDER BY n.created_at, n.id`),
  );
}

function lineOf(row: Pick<NoticeRow, 'title' | 'body'>): string {
  const title = row.title.replace(/\s+/g, ' ').trim();
  const body = row.body.replace(/\s+/g, ' ').trim();
  return body ? `${title}: ${body}` : title;
}

async function markEmailed(db: Database, ids: string[], now: Date): Promise<void> {
  if (ids.length === 0) return;
  await db.update(adminNotices).set({ emailedAt: now }).where(inArray(adminNotices.id, ids));
}

export interface DigestDeps {
  db: Database;
  kek: Uint8Array;
  now?: Date;
}

/**
 * Queues one email for each notice that an "at once" person wants. Called every minute by the outbox job, so
 * "immediate" means within a minute. A notice is marked as emailed, so it is never queued twice.
 */
export async function queueImmediateNotices(deps: DigestDeps): Promise<number> {
  const { db, kek } = deps;
  const now = deps.now ?? new Date();
  let queued = 0;
  for (const row of await pendingNotices(db, now)) {
    if (row.email_frequency !== 'immediate' || !row.address_enc) continue;
    const id = await enqueueEmail(db, kek, {
      kind: 'staff_notice',
      to: openPrefsAddress(kek, row.recipient_id, row.address_enc),
      recipientId: row.recipient_id,
      vars: { title: row.title, body: row.body },
      dedupeKey: `notice:${row.id}`,
      now,
    });
    // A repeated key means an earlier run already queued it; mark it either way so it stops coming back.
    await markEmailed(db, [row.id], now);
    if (id) queued += 1;
  }
  return queued;
}

export interface DigestResult {
  queued: number;
  /** Summaries not built because the person has no stored address yet (they save notification settings once). */
  skipped: number;
}

interface Plan {
  recipientId: string;
  period: 'hour' | 'day';
  address: Buffer | null;
  rows: Array<Pick<NoticeRow, 'id' | 'title' | 'body' | 'created_at'>>;
  markIds: Set<string>;
}

/**
 * Builds the hourly summaries every hour, and the daily ones during the 07:00 Lagos hour. A summary lists the
 * notices the person has not been emailed yet, oldest first, at most 50 lines. The daily summary people asked
 * for covers the last 24 hours of every kind, and merges with their daily email when they have both.
 */
export async function buildDigests(deps: DigestDeps): Promise<DigestResult> {
  const { db, kek } = deps;
  const now = deps.now ?? new Date();
  const { date, hour } = lagosParts(now);
  const daily = hour === DAILY_SUMMARY_HOUR;
  const plans = new Map<string, Plan>();

  const plan = (recipientId: string, period: 'hour' | 'day', address: Buffer | null): Plan => {
    const key = `${recipientId}:${period}`;
    let existing = plans.get(key);
    if (!existing) {
      existing = { recipientId, period, address, rows: [], markIds: new Set() };
      plans.set(key, existing);
    }
    return existing;
  };

  for (const row of await pendingNotices(db, now)) {
    if (row.email_frequency === 'immediate') continue;
    if (row.email_frequency === 'daily' && !daily) continue;
    const target = plan(
      row.recipient_id,
      row.email_frequency === 'daily' ? 'day' : 'hour',
      row.address_enc,
    );
    target.rows.push(row);
    target.markIds.add(row.id);
  }

  if (daily) {
    const stamp = now.toISOString();
    const everything = rowsOf<NoticeRow>(
      await db.execute(sql`
        SELECT n.id, n.recipient_id, n.kind, n.title, n.body, n.created_at, p.address_enc
        FROM admin_notices n
        JOIN staff_notification_prefs p ON p.account_id = n.recipient_id
        WHERE p.daily_summary
          AND n.created_at <= ${stamp}::timestamptz
          AND n.created_at > ${stamp}::timestamptz - interval '24 hours'
        ORDER BY n.created_at, n.id`),
    );
    for (const row of everything) {
      const target = plan(row.recipient_id, 'day', row.address_enc);
      if (!target.rows.some((r) => r.id === row.id)) target.rows.push(row);
    }
  }

  let queued = 0;
  let skipped = 0;
  for (const target of plans.values()) {
    if (target.rows.length === 0) continue;
    if (!target.address) {
      skipped += 1;
      continue;
    }
    const sorted = [...target.rows].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
    const lines = sorted.slice(0, MAX_SUMMARY_LINES).map(lineOf);
    if (sorted.length > MAX_SUMMARY_LINES)
      lines.push(`and ${sorted.length - MAX_SUMMARY_LINES} more`);
    const bucket = target.period === 'day' ? date : now.toISOString().slice(0, 13);
    const id = await enqueueEmail(db, kek, {
      kind: 'staff_summary',
      to: openPrefsAddress(kek, target.recipientId, target.address),
      recipientId: target.recipientId,
      vars: { period: target.period, lines: lines.join('\n') },
      dedupeKey: `digest:${target.period}:${target.recipientId}:${bucket}`,
      now,
    });
    // Mark only after the row exists. A crash between the two repeats a summary, it never loses one.
    if (id) {
      await markEmailed(db, [...target.markIds], now);
      queued += 1;
    }
  }
  return { queued, skipped };
}
