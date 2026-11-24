import type { Currency } from '../money';
import type { DonationRecord, DonationStore, DonationTx } from '../process-event';

/** An in memory donation store for tests. `withReference` queues callers per reference like an advisory lock. */
export function memoryDonationStore() {
  const rows = new Map<string, DonationRecord>();
  const queues = new Map<string, Promise<unknown>>();
  let next = 1;

  const tx: DonationTx = {
    find: async (reference) => rows.get(reference) ?? null,
    update: async (id, patch) => {
      const row = [...rows.values()].find((r) => r.id === id);
      if (!row) throw new Error('unknown donation');
      Object.assign(row, patch);
    },
  };
  const store: DonationStore = {
    find: async (reference) => rows.get(reference) ?? null,
    withReference: (reference, fn) => {
      const previous = queues.get(reference) ?? Promise.resolve();
      const run = previous.then(() => fn(tx));
      queues.set(reference, run.catch(() => undefined));
      return run as Promise<never>;
    },
  };
  return Object.assign(store, {
    add(input: { reference: string; amountMinor: number; currency: Currency; siteMode: 'test' | 'live' }): DonationRecord {
      const row: DonationRecord = {
        id: `d${next++}`,
        status: 'pending',
        paidAmountMinor: null,
        providerTxnId: null,
        channel: null,
        feeMinor: null,
        netMinor: null,
        paidAt: null,
        reviewReason: null,
        ...input,
      };
      rows.set(row.reference, row);
      return row;
    },
    get: (reference: string) => rows.get(reference),
  });
}
