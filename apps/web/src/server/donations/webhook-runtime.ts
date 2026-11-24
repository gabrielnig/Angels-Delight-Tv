import 'server-only';
import { sql } from 'drizzle-orm';
import { adminRuntime } from '../admin/runtime';
import { getServices } from '../../lib/runtime/services';
import { buildPaystackWebhook } from './webhook';

const rowsOf = <T>(result: unknown): T[] => {
  const r = (result as { rows?: unknown } | null)?.rows;
  return Array.isArray(r) ? (r as T[]) : Array.isArray(result) ? (result as T[]) : [];
};

/** Wires the webhook to the database (through the definer function, no table access) and the job queue. */
export function paystackWebhook() {
  const { env, db, logger } = getServices();
  return buildPaystackWebhook({
    secretKey: env.PAYSTACK_SECRET_KEY,
    kek: env.FIELD_KEK,
    insert: async (event) => {
      const row = rowsOf<{ id: string | number | null }>(
        await db.execute(sql`
          SELECT payment_event_insert('paystack', ${event.eventKey}, ${event.eventType}, ${event.reference}, ${Buffer.from(event.payloadEnc)}) AS id`),
      )[0];
      return row?.id === null || row?.id === undefined ? null : Number(row.id);
    },
    enqueue: async (eventId) => {
      await adminRuntime().enqueue('donations.process_event', { eventId });
    },
    // Short facts only: never the body, the reference or the donor.
    log: (fact) => logger.info('paystack webhook', fact),
  });
}
