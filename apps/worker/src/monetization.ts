import type { WorkerEnv } from '@ad/config';
import type { Database } from '@ad/db';
import {
  createPaystackProvider,
  createPgDonationStore,
  openPayload,
  pruneEvents,
  reconcileDonations,
  runProcessEvent,
  type JobDeps,
} from '@ad/payments';
import type { BossLike } from '@ad/queue';
import { sql } from 'drizzle-orm';
import type { MonetizationDeps } from './monetization-handlers';

const DEFAULT_RETENTION_DAYS = 90;

const rowsOf = <T>(result: unknown): T[] => {
  const r = (result as { rows?: unknown } | null)?.rows;
  return Array.isArray(r) ? (r as T[]) : Array.isArray(result) ? (result as T[]) : [];
};

async function retentionDays(db: Database): Promise<number> {
  const row = rowsOf<{ value: unknown }>(
    await db.execute(sql`SELECT value FROM settings WHERE key = 'donate.retention.event_days'`),
  )[0];
  const days = Number(row?.value);
  return Number.isInteger(days) && days >= 7 && days <= 3650 ? days : DEFAULT_RETENTION_DAYS;
}

/**
 * The sponsor and donation jobs for the worker. The reach prune always runs. The donation jobs exist only when a
 * Paystack key is set, and the mode (test or live) comes from the key prefix, so a test key never touches a live row.
 */
export function buildMonetizationDeps(
  env: WorkerEnv,
  db: Database,
  boss: BossLike,
): Pick<MonetizationDeps, 'processEvent' | 'reconcile' | 'pruneEvents' | 'pruneReach'> {
  const pruneReach = async () => {
    const out = rowsOf<{ n: number }>(await db.execute(sql`SELECT sponsor_reach_prune() AS n`))[0];
    return Number(out?.n ?? 0);
  };
  const secret = env.PAYSTACK_SECRET_KEY;
  if (!secret) return { pruneReach };

  const deps: JobDeps = {
    db,
    store: createPgDonationStore(db),
    provider: createPaystackProvider({ secretKey: secret, baseUrl: env.PAYSTACK_BASE_URL }),
    mode: secret.startsWith('sk_live_') ? 'live' : 'test',
    // The receipt is queued here in slice 9, in the same transaction as the status change.
    onSucceeded: async () => undefined,
    open: openPayload(env.FIELD_KEK),
    now: () => new Date(),
    enqueueEvent: async (eventId) => {
      await boss.send('donations.process_event', { eventId });
    },
  };
  return {
    pruneReach,
    processEvent: (eventId, job) => runProcessEvent(deps, eventId, job),
    reconcile: async () => ({ ...(await reconcileDonations(deps)) }),
    pruneEvents: async () => pruneEvents(db, await retentionDays(db), new Date()),
  };
}
