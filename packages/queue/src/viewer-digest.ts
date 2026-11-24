import type { Database } from '@ad/db';
import { sql } from 'drizzle-orm';
import { enqueueEmail, openAddress, sealAddress } from './outbox';

export { signUnsubscribeToken, verifyUnsubscribeToken } from './unsubscribe-token';

/**
 * The viewer email digest (L5, M44-S15). One email per account per day (weekly on Mondays), titles only, merged
 * from the non kids profiles and limited by the primary profile's maturity limit. It never says which profile
 * follows what. The worker reads through `notice_digest_candidates()` and never sees `profiles` or `accounts`.
 */

export const VIEWER_DIGEST_TIMEZONE = 'Africa/Lagos';
export const MAX_DIGEST_LINES = 10;
const WINDOW_DAYS = 7;

export type DigestFrequency = 'daily' | 'weekly';

export function sealViewerAddress(kek: Uint8Array, accountId: string, address: string): Buffer {
  return sealAddress(kek, `viewer-prefs:${accountId}`, address);
}

export function openViewerAddress(kek: Uint8Array, accountId: string, sealed: Uint8Array): string {
  return openAddress(kek, `viewer-prefs:${accountId}`, sealed);
}

function lagos(now: Date): { date: string; weekday: string } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: VIEWER_DIGEST_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'long',
  }).formatToParts(now);
  const pick = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return { date: `${pick('year')}-${pick('month')}-${pick('day')}`, weekday: pick('weekday') };
}

/** Daily goes out every day, weekly on Monday, by the Lagos calendar. */
export function isDigestDay(frequency: DigestFrequency, now: Date): boolean {
  return frequency === 'daily' || lagos(now).weekday === 'Monday';
}

interface Candidate {
  notice_id: string;
  account_id: string;
  frequency: DigestFrequency;
  address_enc: Buffer;
  title: string;
  created_at: Date;
}

function rowsOf<T>(result: unknown): T[] {
  return Array.isArray(result) ? (result as T[]) : (((result as { rows?: T[] }).rows ?? []) as T[]);
}

export interface ViewerDigestDeps {
  db: Database;
  kek: Uint8Array;
  now?: Date;
}

export async function buildViewerDigests(deps: ViewerDigestDeps): Promise<{ queued: number }> {
  const { db, kek } = deps;
  const now = deps.now ?? new Date();
  const since = new Date(now.getTime() - WINDOW_DAYS * 86_400_000).toISOString();
  const { date } = lagos(now);
  const candidates = rowsOf<Candidate>(
    await db.execute(sql`SELECT * FROM notice_digest_candidates(${since}::timestamptz)`),
  );
  const byAccount = new Map<string, Candidate[]>();
  for (const row of candidates) {
    if (!isDigestDay(row.frequency, now)) continue;
    const list = byAccount.get(row.account_id) ?? [];
    list.push(row);
    byAccount.set(row.account_id, list);
  }

  let queued = 0;
  for (const [accountId, rows] of byAccount) {
    const first = rows[0]!;
    let to: string;
    try {
      to = openViewerAddress(kek, accountId, first.address_enc);
    } catch {
      continue;
    }
    const titles = [...new Set(rows.map((r) => r.title.replace(/\s+/g, ' ').trim()))].filter(Boolean);
    const lines =
      titles.length > MAX_DIGEST_LINES
        ? [...titles.slice(0, MAX_DIGEST_LINES - 1), `and ${titles.length - (MAX_DIGEST_LINES - 1)} more`]
        : titles;
    if (lines.length === 0) continue;
    const id = await enqueueEmail(db, kek, {
      kind: first.frequency === 'weekly' ? 'viewer_digest_weekly' : 'viewer_digest_daily',
      to,
      recipientId: accountId,
      vars: { period: first.frequency === 'weekly' ? 'week' : 'day', lines: lines.join('\n'), accountId },
      dedupeKey: `viewer-digest:${accountId}:${date}`,
      now,
    });
    // Mark after the row exists. A crash between the two repeats one digest, it never loses one. A repeated
    // dedupe key means an earlier run queued it, so the notices are marked either way.
    const ids = rows.map((r) => sql`${r.notice_id}::uuid`);
    await db.execute(
      sql`UPDATE viewer_notices SET emailed_at = ${now.toISOString()}::timestamptz WHERE id IN (${sql.join(ids, sql`, `)})`,
    );
    if (id) queued += 1;
  }
  return { queued };
}
