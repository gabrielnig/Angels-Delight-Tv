import { schema, type Database } from '@ad/db';
import { eq, sql } from 'drizzle-orm';
import type { DonationPatch, DonationRecord, DonationStatus, DonationStore, DonationTx } from './process-event';

const { donations } = schema;

const toRecord = (r: typeof donations.$inferSelect): DonationRecord => ({
  id: r.id,
  reference: r.reference,
  status: r.status as DonationStatus,
  currency: r.currency as 'NGN' | 'USD',
  amountMinor: r.amountMinor,
  siteMode: r.siteMode as 'test' | 'live',
  paidAmountMinor: r.paidAmountMinor,
  providerTxnId: r.providerTxnId,
  channel: r.channel,
  feeMinor: r.feeMinor,
  netMinor: r.netMinor,
  paidAt: r.paidAt,
  reviewReason: r.reviewReason,
});

type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];

const txView = (tx: Tx): DonationTx & { raw: Tx } => ({
  raw: tx,
  async find(reference) {
    const rows = await tx.select().from(donations).where(eq(donations.reference, reference)).limit(1);
    return rows[0] ? toRecord(rows[0]) : null;
  },
  async update(id, patch: DonationPatch) {
    await tx.update(donations).set(patch).where(eq(donations.id, id));
  },
});

/**
 * Donation access for the worker. `withReference` opens a transaction and takes an advisory lock on the reference,
 * so two jobs for one donation run one after the other. The worker role has no account context: its policy on the
 * donations table allows it, and nothing here touches accounts or profiles.
 */
export function createPgDonationStore(db: Database): DonationStore {
  return {
    async find(reference) {
      const rows = await db.select().from(donations).where(eq(donations.reference, reference)).limit(1);
      return rows[0] ? toRecord(rows[0]) : null;
    },
    withReference(reference, fn) {
      return db.transaction(async (tx) => {
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${reference}, 0))`);
        return fn(txView(tx));
      });
    },
  };
}

/** The raw transaction behind a `DonationTx` from this store, for writes that must commit with the status change. */
export const rawTransaction = (tx: DonationTx): Tx => (tx as ReturnType<typeof txView>).raw;
