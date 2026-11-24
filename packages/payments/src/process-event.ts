import type { Currency } from './money';
import type { PaymentProvider } from './provider';
import { isValidReference } from './reference';

export type DonationStatus = 'pending' | 'succeeded' | 'failed' | 'abandoned' | 'refunded' | 'needs_review';

export interface DonationRecord {
  id: string;
  reference: string;
  status: DonationStatus;
  currency: Currency;
  amountMinor: number;
  siteMode: 'test' | 'live';
  paidAmountMinor: number | null;
  providerTxnId: string | null;
  channel: string | null;
  feeMinor: number | null;
  netMinor: number | null;
  paidAt: Date | null;
  reviewReason: string | null;
}

export type DonationPatch = Partial<Omit<DonationRecord, 'id' | 'reference' | 'currency' | 'amountMinor' | 'siteMode'>>;

/** One locked view of a donation. Everything done through it commits or rolls back together. */
export interface DonationTx {
  find(reference: string): Promise<DonationRecord | null>;
  update(id: string, patch: DonationPatch): Promise<void>;
}

export interface DonationStore {
  /** A plain read, no lock. */
  find(reference: string): Promise<DonationRecord | null>;
  /** Runs `fn` while holding a lock keyed by the reference, in one transaction. Two calls for one reference never overlap. */
  withReference<T>(reference: string, fn: (tx: DonationTx) => Promise<T>): Promise<T>;
}

export interface ProcessDeps {
  store: DonationStore;
  provider: PaymentProvider;
  /** From the key prefix: a test key runs in test mode, a live key in live mode. */
  mode: 'test' | 'live';
  /**
   * Called once, inside the same transaction as the status change, when a donation first becomes succeeded. A throw
   * rolls the change back so a retry does it again. This is where the receipt is queued.
   */
  onSucceeded(donation: DonationRecord, tx: DonationTx): Promise<void>;
}

export interface EventToProcess {
  eventType: string;
  payload: unknown;
  /** 1 for the first try. */
  attempt: number;
}

export type ProcessOutcome =
  | 'succeeded'
  | 'already_succeeded'
  | 'already_final'
  | 'needs_review'
  | 'failed'
  | 'refunded'
  | 'orphan'
  | 'mode_mismatch'
  | 'ignored';

/** The event cannot be settled yet. The job runs again later. */
export class RetryLater extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RetryLater';
  }
}

/** After this many tries an event for a reference we do not have is stored as an orphan. */
export const ORPHAN_AFTER_ATTEMPTS = 3;

const OPEN: ReadonlySet<DonationStatus> = new Set(['pending', 'abandoned', 'failed']);
const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
const text = (value: unknown): string | null => (typeof value === 'string' && value ? value : null);
const whole = (value: unknown): number | null =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;

/**
 * Settles one stored webhook event. The event only says which donation to look at: the amount, currency and status
 * always come from asking Paystack (verify), so a forged or altered body cannot mark anything paid. Safe to run any
 * number of times for the same event.
 */
export async function processEvent(deps: ProcessDeps, event: EventToProcess): Promise<ProcessOutcome> {
  const body = asRecord(event.payload);
  const data = asRecord(body?.data);
  if (!body || !data) return 'ignored';

  if (event.eventType === 'charge.success') return chargeSuccess(deps, event, data);
  if (event.eventType === 'charge.failed') return chargeFailed(deps, event, data);
  if (event.eventType === 'refund.processed') return refundProcessed(deps, event, data);
  return 'ignored';
}

const modeOk = (deps: ProcessDeps, data: Record<string, unknown>, row: DonationRecord | null) => {
  const domain = text(data.domain);
  if (domain && domain !== deps.mode) return false;
  return !row || row.siteMode === deps.mode;
};

async function lookup(
  deps: ProcessDeps,
  event: EventToProcess,
  reference: string | null,
): Promise<DonationRecord | 'orphan'> {
  if (!reference || !isValidReference(reference)) return 'orphan';
  const row = await deps.store.find(reference);
  if (row) return row;
  if (event.attempt < ORPHAN_AFTER_ATTEMPTS) throw new RetryLater('The donation row is not visible yet');
  return 'orphan';
}

async function chargeSuccess(deps: ProcessDeps, event: EventToProcess, data: Record<string, unknown>): Promise<ProcessOutcome> {
  const found = await lookup(deps, event, text(data.reference));
  if (found === 'orphan') return 'orphan';
  if (!modeOk(deps, data, found)) return 'mode_mismatch';
  if (found.status === 'succeeded') return 'already_succeeded';
  if (!OPEN.has(found.status)) return 'already_final';

  const verdict = await deps.provider.verify(found.reference, { amountMinor: found.amountMinor, currency: found.currency });
  if (verdict.status !== 'paid') {
    if (verdict.status === 'needs_review') return review(deps, found.reference, verdict.reason, verdict.amountMinor);
    // The event says paid but Paystack says otherwise. Wait for Paystack to catch up, then ask a person.
    if (event.attempt < ORPHAN_AFTER_ATTEMPTS) throw new RetryLater('Paystack does not confirm the payment yet');
    return review(deps, found.reference, 'not_confirmed', null);
  }

  const fee = whole(data.fees);
  return deps.store.withReference(found.reference, async (tx) => {
    const fresh = await tx.find(found.reference);
    if (!fresh) return 'orphan';
    if (fresh.status === 'succeeded') return 'already_succeeded';
    if (!OPEN.has(fresh.status)) return 'already_final';
    const txnId = data.id === undefined || data.id === null ? null : String(data.id);
    await tx.update(fresh.id, {
      status: 'succeeded',
      paidAmountMinor: verdict.amountMinor,
      providerTxnId: txnId,
      channel: text(data.channel),
      feeMinor: fee,
      netMinor: fee === null ? null : Math.max(0, verdict.amountMinor - fee),
      paidAt: verdict.paidAt ?? new Date(),
      reviewReason: null,
    });
    await deps.onSucceeded({ ...fresh, status: 'succeeded', paidAmountMinor: verdict.amountMinor }, tx);
    return 'succeeded';
  });
}

async function review(deps: ProcessDeps, reference: string, reason: string, paid: number | null): Promise<ProcessOutcome> {
  return deps.store.withReference(reference, async (tx) => {
    const fresh = await tx.find(reference);
    if (!fresh) return 'orphan';
    if (fresh.status === 'succeeded') return 'already_succeeded';
    if (fresh.status === 'refunded') return 'already_final';
    await tx.update(fresh.id, { status: 'needs_review', reviewReason: reason, paidAmountMinor: paid ?? fresh.paidAmountMinor });
    return 'needs_review';
  });
}

async function chargeFailed(deps: ProcessDeps, event: EventToProcess, data: Record<string, unknown>): Promise<ProcessOutcome> {
  const found = await lookup(deps, event, text(data.reference));
  if (found === 'orphan') return 'orphan';
  if (!modeOk(deps, data, found)) return 'mode_mismatch';
  return deps.store.withReference(found.reference, async (tx) => {
    const fresh = await tx.find(found.reference);
    if (!fresh) return 'orphan';
    if (fresh.status !== 'pending') return 'already_final';
    await tx.update(fresh.id, { status: 'failed' });
    return 'failed';
  });
}

async function refundProcessed(deps: ProcessDeps, event: EventToProcess, data: Record<string, unknown>): Promise<ProcessOutcome> {
  const found = await lookup(deps, event, text(data.transaction_reference) ?? text(data.reference));
  if (found === 'orphan') return 'orphan';
  if (!modeOk(deps, data, found)) return 'mode_mismatch';
  return deps.store.withReference(found.reference, async (tx) => {
    const fresh = await tx.find(found.reference);
    if (!fresh) return 'orphan';
    if (fresh.status === 'refunded') return 'already_final';
    if (fresh.status !== 'succeeded' && fresh.status !== 'needs_review') return 'ignored';
    await tx.update(fresh.id, { status: 'refunded' });
    return 'refunded';
  });
}
