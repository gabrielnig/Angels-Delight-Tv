import { Forbidden, ValidationFailed } from '@ad/shared';
import { describe, expect, it } from 'vitest';
import { DONATION_EXPORT_MAX_ROWS, DonationAdminService, donationsCsv, maskEmail, summarize, type AdminDonation, type DonationAdminStore } from './service';

const admin = { accountId: 'a1', role: 'admin' as const };
const superAdmin = { accountId: 's1', role: 'super_admin' as const };
const editor = { accountId: 'e1', role: 'editor' as const };

const row = (over: Partial<AdminDonation> = {}): AdminDonation => ({
  id: 'd1',
  reference: 'ad-don-abcdefghij0123456789',
  status: 'succeeded',
  kind: 'one_time',
  currency: 'NGN',
  amountMinor: 100000,
  paidAmountMinor: 100000,
  siteMode: 'live',
  anonymous: false,
  donorName: 'Chidi',
  donorEmail: 'chidi@example.com',
  channel: 'card',
  reviewReason: null,
  receiptSentAt: new Date('2026-11-24T10:00:00Z'),
  createdAt: new Date('2026-11-24T09:00:00Z'),
  paidAt: new Date('2026-11-24T09:01:00Z'),
  ...over,
});

function make(rows: AdminDonation[] = [row()]) {
  const audits: Array<Record<string, unknown>> = [];
  const resolved: Array<Record<string, unknown>> = [];
  let lastFilter: unknown;
  const store: DonationAdminStore = {
    list: async (filter) => ((lastFilter = filter), rows),
    get: async (id) => rows.find((r) => r.id === id) ?? null,
    resolve: async (id, accept, note) => {
      resolved.push({ id, accept, note });
      return true;
    },
    audit: async (entry) => void audits.push(entry as never),
  };
  return { svc: new DonationAdminService({ store }), audits, resolved, filter: () => lastFilter };
}

describe('maskEmail', () => {
  it('keeps the first letter and the domain', () => {
    expect(maskEmail('chidi@example.com')).toBe('c***@example.com');
    expect(maskEmail('x')).toBe('***');
  });
});

describe('DonationAdminService', () => {
  it('lets admin and super admin list, and refuses an editor', async () => {
    expect((await make().svc.list(admin, {})).rows).toHaveLength(1);
    expect((await make().svc.list(superAdmin, {})).rows).toHaveLength(1);
    await expect(make().svc.list(editor, {})).rejects.toBeInstanceOf(Forbidden);
    await expect(make().svc.get(editor, 'd1')).rejects.toBeInstanceOf(Forbidden);
    await expect(make().svc.exportCsv(editor, {})).rejects.toBeInstanceOf(Forbidden);
  });

  it('never returns the full email or the plain name of an anonymous donor in the list', async () => {
    const { rows } = await make([row(), row({ id: 'd2', anonymous: true, donorName: 'Secret Name' })]).svc.list(admin, {});
    const text = JSON.stringify(rows);
    expect(text).not.toContain('chidi@example.com');
    expect(rows[0]!.emailMasked).toBe('c***@example.com');
    expect(text).not.toContain('Secret Name');
    expect(rows[1]!.donorName).toBeNull();
    expect(rows[0]!.donorName).toBe('Chidi');
  });

  it('passes the filters to the store, normalising unknown values away', async () => {
    const m = make();
    await m.svc.list(admin, { status: 'succeeded', kind: 'monthly', from: '2026-11-01', to: '2026-11-30' });
    expect(m.filter()).toMatchObject({ status: 'succeeded', kind: 'monthly', from: '2026-11-01', to: '2026-11-30' });
    await m.svc.list(admin, { status: 'bogus' as never, kind: 'x' as never, from: 'not a date' });
    expect(m.filter()).toEqual({ limit: 200 });
  });

  it('marks test rows and leaves them out of the totals, and never mixes currencies', () => {
    const totals = summarize([
      row(),
      row({ id: '2', amountMinor: 50000, paidAmountMinor: 50000 }),
      row({ id: '3', siteMode: 'test', amountMinor: 999999, paidAmountMinor: 999999 }),
      row({ id: '4', currency: 'USD', amountMinor: 1000, paidAmountMinor: 1000 }),
      row({ id: '5', status: 'pending', amountMinor: 700000, paidAmountMinor: null }),
    ]);
    expect(totals).toEqual({ NGN: { count: 2, minor: 150000 }, USD: { count: 1, minor: 1000 } });
  });

  it('reveals a full email only to an admin, and records the reveal without the address', async () => {
    const m = make();
    expect(await m.svc.revealEmail(admin, 'd1')).toBe('chidi@example.com');
    expect(m.audits).toHaveLength(1);
    expect(m.audits[0]).toMatchObject({ action: 'donation.reveal_email', targetType: 'donation', targetId: 'd1' });
    expect(JSON.stringify(m.audits)).not.toContain('chidi@example.com');
    await expect(m.svc.revealEmail(editor, 'd1')).rejects.toBeInstanceOf(Forbidden);
  });

  it('exports a CSV that escapes, neutralises formulas, hides anonymous names and is audited', async () => {
    const m = make([row({ donorName: '=HYPERLINK("x")' }), row({ id: 'd2', anonymous: true, donorName: 'Hidden' })]);
    const out = await m.svc.exportCsv(admin, {});
    expect(out.csv.split('\n')[0]).toBe('reference,created,status,kind,currency,amount,paid_amount,mode,channel,name,email_masked,receipt_queued');
    expect(out.csv).toContain(`"'=HYPERLINK(""x"")"`);
    expect(out.csv).not.toContain('Hidden');
    expect(out.csv).not.toContain('chidi@example.com');
    expect(m.audits[0]).toMatchObject({ action: 'donation.export', metadata: { rows: 2 } });
    expect(out.fileName).toMatch(/^donations-\d{4}-\d{2}-\d{2}\.csv$/);
  });

  it('refuses an export above the row cap and writes nothing', async () => {
    const many = Array.from({ length: DONATION_EXPORT_MAX_ROWS + 1 }, (_, i) => row({ id: String(i) }));
    const m = make(many);
    await expect(m.svc.exportCsv(admin, {})).rejects.toBeInstanceOf(ValidationFailed);
    expect(m.audits).toEqual([]);
  });

  it('shows expected versus paid for a gift that needs review', async () => {
    const { rows } = await make([row({ status: 'needs_review', amountMinor: 500000, paidAmountMinor: 100000, reviewReason: 'amount_lower' })]).svc.list(admin, {});
    expect(rows[0]).toMatchObject({ expectedMinor: 500000, paidMinor: 100000, reviewReason: 'amount_lower' });
  });

  it('needs a note to resolve a review, then resolves and audits it', async () => {
    const m = make([row({ status: 'needs_review', reviewReason: 'amount_lower' })]);
    await expect(m.svc.resolveReview(admin, 'd1', true, '  ')).rejects.toBeInstanceOf(ValidationFailed);
    await expect(m.svc.resolveReview(admin, 'd1', true, 'x'.repeat(501))).rejects.toBeInstanceOf(ValidationFailed);
    expect(m.resolved).toEqual([]);
    await m.svc.resolveReview(admin, 'd1', true, 'Donor confirmed the lower amount');
    expect(m.resolved).toEqual([{ id: 'd1', accept: true, note: 'Donor confirmed the lower amount' }]);
    expect(m.audits[0]).toMatchObject({ action: 'donation.review_resolve', metadata: { accepted: true } });
    await expect(m.svc.resolveReview(editor, 'd1', true, 'note')).rejects.toBeInstanceOf(Forbidden);
  });

  it('only resolves a gift that is actually waiting for review', async () => {
    const m = make([row()]);
    await expect(m.svc.resolveReview(admin, 'd1', true, 'note')).rejects.toBeInstanceOf(ValidationFailed);
  });
});

describe('donationsCsv', () => {
  it('writes amounts as decimals from minor units', () => {
    const csv = donationsCsv([row({ amountMinor: 123456, paidAmountMinor: 123456 })], { masked: (e) => maskEmail(e) });
    expect(csv).toContain(',1234.56,1234.56,');
  });
});
