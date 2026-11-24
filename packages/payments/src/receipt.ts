import { formatMoney } from './money';
import type { Currency } from './money';

export interface ReceiptDonation {
  id: string;
  reference: string;
  currency: Currency;
  amountMinor: number;
  paidAt: Date;
  donorName?: string | null;
}

export interface ReceiptOptions {
  orgName: string;
  /** Shown only when the owner configures it. No tax claim is ever made by default. */
  taxNote?: string;
}

export type ReceiptVars = Record<string, string>;

export function receiptDedupeKey(donationId: string): string {
  return `receipt:${donationId}`;
}

function cleanName(name: string | null | undefined): string {
  return (name ?? '').replace(/[<>&"'`]/g, '').replace(/\s+/g, ' ').trim().slice(0, 80);
}

function lagosDate(d: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Africa/Lagos',
  }).format(d);
}

export function buildReceiptVars(donation: ReceiptDonation, opts: ReceiptOptions): ReceiptVars {
  return {
    reference: donation.reference,
    amount: formatMoney(donation.amountMinor, donation.currency),
    date: lagosDate(donation.paidAt),
    orgName: opts.orgName,
    donorName: cleanName(donation.donorName),
    taxNote: opts.taxNote?.trim() ?? '',
  };
}

export interface ReceiptEnqueueInput {
  kind: 'donation_receipt';
  to: string;
  vars: ReceiptVars;
  dedupeKey: string;
}

/** Hands the receipt to an outbox enqueue function. Dedupe key keeps a replayed webhook from sending twice. */
export async function enqueueReceipt(
  enqueue: (input: ReceiptEnqueueInput) => Promise<unknown>,
  to: string,
  donation: ReceiptDonation,
  opts: ReceiptOptions,
): Promise<void> {
  await enqueue({
    kind: 'donation_receipt',
    to,
    vars: buildReceiptVars(donation, opts),
    dedupeKey: receiptDedupeKey(donation.id),
  });
}
