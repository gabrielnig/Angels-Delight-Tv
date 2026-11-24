import type { Database } from '@ad/db';
import {
  enqueueReceipt,
  openDonorField,
  rawTransaction,
  type DonationRecord,
  type DonationTx,
  type ProcessDeps,
} from '@ad/payments';
import { enqueueEmail } from '@ad/queue';
import { sql } from 'drizzle-orm';

export interface ReceiptHookDeps {
  kek: Uint8Array;
  orgName(): Promise<string>;
  warn?(message: string): void;
  now(): Date;
}

const rowsOf = <T>(result: unknown): T[] => {
  const r = (result as { rows?: unknown } | null)?.rows;
  return Array.isArray(r) ? (r as T[]) : Array.isArray(result) ? (result as T[]) : [];
};

/**
 * The `onSucceeded` step of the donation processor (M48-S30). It runs inside the transaction that marks the gift
 * succeeded, so the receipt row and `receipt_sent_at` commit with the status or not at all. The outbox dedupe key
 * `receipt:<donationId>` makes a replay harmless. `receipt_sent_at` records that the receipt was queued; delivery
 * itself is retried by the outbox. An email that cannot be opened (a rotated key) skips the receipt and keeps the
 * donation recorded as paid, and the warning never carries the address.
 */
export function createReceiptHook(deps: ReceiptHookDeps): ProcessDeps['onSucceeded'] {
  return async (donation: DonationRecord, tx: DonationTx) => {
    const raw = rawTransaction(tx);
    const found = rowsOf<{ donor_email_enc: Uint8Array; donor_name_enc: Uint8Array | null; receipt_sent_at: Date | null }>(
      await raw.execute(sql`SELECT donor_email_enc, donor_name_enc, receipt_sent_at FROM donations WHERE id = ${donation.id}`),
    )[0];
    if (!found || found.receipt_sent_at) return;

    let email: string;
    let name: string | null = null;
    try {
      email = openDonorField(deps.kek, donation.id, 'email', found.donor_email_enc);
      if (found.donor_name_enc) name = openDonorField(deps.kek, donation.id, 'name', found.donor_name_enc);
    } catch {
      deps.warn?.('donation receipt skipped: the donor email could not be read');
      return;
    }

    const now = deps.now();
    const orgName = (await deps.orgName()).trim();
    await enqueueReceipt(
      (input) => enqueueEmail(raw as unknown as Database, deps.kek, { ...input, now }),
      email,
      {
        id: donation.id,
        reference: donation.reference,
        currency: donation.currency,
        amountMinor: donation.paidAmountMinor ?? donation.amountMinor,
        paidAt: donation.paidAt ?? now,
        donorName: name,
      },
      { orgName },
    );
    await raw.execute(sql`UPDATE donations SET receipt_sent_at = ${now} WHERE id = ${donation.id}`);
  };
}
