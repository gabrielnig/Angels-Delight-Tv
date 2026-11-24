import { describe, expect, it, vi } from 'vitest';
import { buildReceiptVars, receiptDedupeKey, enqueueReceipt } from './receipt';

const donation = {
  id: 'd1',
  reference: 'ad-don-abcdefghij0123456789',
  currency: 'NGN' as const,
  amountMinor: 500000,
  paidAt: new Date('2026-11-24T10:00:00Z'),
  donorName: 'Ada <b>Obi</b>',
};

describe('buildReceiptVars', () => {
  it('carries reference, amount, currency, date and organisation name', () => {
    const v = buildReceiptVars(donation, { orgName: 'Angels Delight' });
    expect(v.reference).toBe(donation.reference);
    expect(v.amount).toContain('5,000');
    expect(v.date).toContain('2026');
    expect(v.orgName).toBe('Angels Delight');
  });

  it('makes no tax claim unless a note is configured', () => {
    const plain = buildReceiptVars(donation, { orgName: 'X' });
    expect(JSON.stringify(plain).toLowerCase()).not.toContain('deductible');
    expect(plain.taxNote).toBe('');
    expect(buildReceiptVars(donation, { orgName: 'X', taxNote: 'Reg 123' }).taxNote).toBe('Reg 123');
  });

  it('strips markup characters from the donor name', () => {
    const v = buildReceiptVars(donation, { orgName: 'X' });
    expect(v.donorName).not.toMatch(/[<>]/);
  });

  it('uses a stable dedupe key per donation', () => {
    expect(receiptDedupeKey('d1')).toBe('receipt:d1');
  });
});

describe('enqueueReceipt', () => {
  it('enqueues kind donation_receipt with the dedupe key', async () => {
    const enqueue = vi.fn().mockResolvedValue(undefined);
    await enqueueReceipt(enqueue, 'a@example.org', donation, { orgName: 'X' });
    expect(enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'donation_receipt', to: 'a@example.org', dedupeKey: 'receipt:d1' }),
    );
  });
});
