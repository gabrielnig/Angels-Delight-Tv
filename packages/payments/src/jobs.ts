import type { Database } from '@ad/db';
import { sql } from 'drizzle-orm';
import {
  ORPHAN_AFTER_ATTEMPTS,
  processEvent,
  type DonationStore,
  type ProcessDeps,
  type ProcessOutcome,
} from './process-event';

export interface JobDeps extends ProcessDeps {
  db: Database;
  store: DonationStore;
  /** Decrypts a stored webhook payload. */
  open(bytes: Uint8Array): Promise<Uint8Array>;
  now(): Date;
  /** Queues `donations.process_event` for a stored event. */
  enqueueEvent(eventId: number): Promise<void>;
}

const rowsOf = <T>(result: unknown): T[] => {
  const r = (result as { rows?: unknown } | null)?.rows;
  return Array.isArray(r) ? (r as T[]) : Array.isArray(result) ? (result as T[]) : [];
};

const MINUTE = 60_000;
export const RECONCILE_AFTER_MINUTES = 15;
export const ABANDON_AFTER_HOURS = 24;
export const STUCK_EVENT_MINUTES = 5;

const shortMessage = (error: unknown) => (error instanceof Error ? error.message : String(error)).slice(0, 300);

/**
 * The `donations.process_event` job. Loads the stored event, settles it, and records the outcome. A temporary
 * problem throws so the queue retries; on the last try the event ends in a failed state with the reason, which the
 * admin donations page shows as needing attention.
 */
export async function runProcessEvent(
  deps: JobDeps,
  eventId: number,
  job: { attempt: number; isLastAttempt: boolean },
): Promise<ProcessOutcome | 'skipped' | 'failed'> {
  const found = rowsOf<{ event_type: string; payload_enc: Uint8Array | null; processed_at: Date | null }>(
    await deps.db.execute(sql`SELECT event_type, payload_enc, processed_at FROM payment_events WHERE id = ${eventId}`),
  )[0];
  if (!found || found.processed_at) return 'skipped';

  await deps.db.execute(sql`UPDATE payment_events SET attempts = attempts + 1 WHERE id = ${eventId}`);
  const finish = async (outcome: string, error: string | null) => {
    await deps.db.execute(
      sql`UPDATE payment_events SET processed_at = ${deps.now()}, outcome = ${outcome}, error = ${error} WHERE id = ${eventId}`,
    );
  };

  let payload: unknown;
  try {
    if (!found.payload_enc) throw new Error('empty payload');
    payload = JSON.parse(new TextDecoder().decode(await deps.open(new Uint8Array(found.payload_enc))));
  } catch {
    await finish('failed', 'The stored event could not be read');
    return 'failed';
  }

  try {
    const outcome = await processEvent(deps, { eventType: found.event_type, payload, attempt: job.attempt });
    await finish(outcome, null);
    return outcome;
  } catch (error) {
    if (job.isLastAttempt) {
      await finish('failed', shortMessage(error));
      return 'failed';
    }
    await deps.db.execute(sql`UPDATE payment_events SET error = ${shortMessage(error)} WHERE id = ${eventId}`);
    throw error;
  }
}

export interface ReconcileResult {
  checked: number;
  succeeded: number;
  failed: number;
  abandoned: number;
  requeued: number;
  errors: number;
}

/**
 * The `donations.reconcile` job. Asks Paystack about pending donations older than 15 minutes, settles the ones that
 * were paid or failed, marks the ones still open after 24 hours as abandoned, and queues stored events nobody
 * processed. One failed call never stops the others, and the next run tries again. A succeeded donation is never
 * touched.
 */
export async function reconcileDonations(deps: JobDeps): Promise<ReconcileResult> {
  const now = deps.now();
  const result: ReconcileResult = { checked: 0, succeeded: 0, failed: 0, abandoned: 0, requeued: 0, errors: 0 };

  const stuck = rowsOf<{ id: string | number }>(
    await deps.db.execute(sql`
      SELECT id FROM payment_events
       WHERE processed_at IS NULL AND received_at < ${new Date(now.getTime() - STUCK_EVENT_MINUTES * MINUTE)}
       ORDER BY id LIMIT 100`),
  );
  for (const row of stuck) {
    try {
      await deps.enqueueEvent(Number(row.id));
      result.requeued += 1;
    } catch {
      result.errors += 1;
    }
  }

  const pending = rowsOf<{ reference: string; amount_minor: string | number; currency: 'NGN' | 'USD'; created_at: Date | string }>(
    await deps.db.execute(sql`
      SELECT reference, amount_minor, currency, created_at FROM donations
       WHERE status = 'pending' AND source = 'paystack' AND site_mode = ${deps.mode}
         AND created_at < ${new Date(now.getTime() - RECONCILE_AFTER_MINUTES * MINUTE)}
       ORDER BY created_at LIMIT 200`),
  );
  for (const row of pending) {
    result.checked += 1;
    const old = now.getTime() - new Date(row.created_at).getTime() > ABANDON_AFTER_HOURS * 60 * MINUTE;
    try {
      const verdict = await deps.provider.verify(row.reference, { amountMinor: Number(row.amount_minor), currency: row.currency });
      if (verdict.status === 'paid' || verdict.status === 'needs_review') {
        const outcome = await processEvent(deps, {
          eventType: 'charge.success',
          attempt: ORPHAN_AFTER_ATTEMPTS,
          payload: { event: 'charge.success', data: { reference: row.reference, domain: deps.mode } },
        });
        if (outcome === 'succeeded') result.succeeded += 1;
      } else if (verdict.status === 'failed') {
        if (await setIfPending(deps, row.reference, 'failed')) result.failed += 1;
      } else if (old) {
        if (await setIfPending(deps, row.reference, 'abandoned')) result.abandoned += 1;
      }
    } catch {
      result.errors += 1;
    }
  }
  return result;
}

async function setIfPending(deps: JobDeps, reference: string, status: 'failed' | 'abandoned'): Promise<boolean> {
  return deps.store.withReference(reference, async (tx) => {
    const row = await tx.find(reference);
    if (!row || row.status !== 'pending') return false;
    await tx.update(row.id, { status });
    return true;
  });
}

/** The `donations.prune_events` job: empties old payloads of processed events. The rows stay so repeats are still recognised. */
export async function pruneEvents(db: Database, retentionDays: number, now: Date): Promise<number> {
  const cutoff = new Date(now.getTime() - retentionDays * 86_400_000);
  const emptied = rowsOf<{ id: number }>(
    await db.execute(sql`
      UPDATE payment_events SET payload_enc = NULL
       WHERE payload_enc IS NOT NULL AND processed_at IS NOT NULL AND received_at < ${cutoff}
       RETURNING id`),
  );
  return emptied.length;
}
