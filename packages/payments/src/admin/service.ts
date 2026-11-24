import { Forbidden, NotFound, ValidationFailed, isAdminRole } from '@ad/shared';
import type { Currency } from '../money';
import type { DonationStatus } from '../process-event';

export type DonationKindName = 'one_time' | 'monthly';
export const DONATION_EXPORT_MAX_ROWS = 10_000;
const LIST_LIMIT = 200;

export interface AdminDonation {
  id: string;
  reference: string;
  status: DonationStatus;
  kind: DonationKindName;
  currency: Currency;
  amountMinor: number;
  paidAmountMinor: number | null;
  siteMode: 'test' | 'live';
  anonymous: boolean;
  donorName: string | null;
  /** The full address, opened from the sealed column. It never leaves this service except through `revealEmail`. */
  donorEmail: string;
  channel: string | null;
  reviewReason: string | null;
  receiptSentAt: Date | null;
  createdAt: Date;
  paidAt: Date | null;
}

export interface DonationFilter {
  status?: DonationStatus;
  kind?: DonationKindName;
  /** Lagos calendar days, inclusive. */
  from?: string;
  to?: string;
  limit?: number;
}

export interface DonationAuditEntry {
  action: 'donation.export' | 'donation.reveal_email' | 'donation.review_resolve';
  actorAccountId: string;
  actorRole: string;
  targetType: 'donation';
  targetId: string | null;
  metadata: Record<string, string | number | boolean>;
}

export interface DonationAdminStore {
  list(filter: DonationFilter): Promise<AdminDonation[]>;
  get(id: string): Promise<AdminDonation | null>;
  /** Accepting makes the gift succeeded, rejecting makes it failed. Returns false when it was not waiting for review. */
  resolve(id: string, accept: boolean, note: string): Promise<boolean>;
  audit(entry: DonationAuditEntry): Promise<void>;
}

export interface AdminActor {
  accountId: string;
  role: string;
}

export interface DonationListItem {
  id: string;
  reference: string;
  status: DonationStatus;
  kind: DonationKindName;
  currency: Currency;
  expectedMinor: number;
  paidMinor: number | null;
  test: boolean;
  anonymous: boolean;
  donorName: string | null;
  emailMasked: string;
  channel: string | null;
  reviewReason: string | null;
  receiptQueued: boolean;
  createdAt: Date;
  paidAt: Date | null;
}

export type Totals = Partial<Record<Currency, { count: number; minor: number }>>;

export function maskEmail(email: string): string {
  const [local = '', domain = ''] = email.split('@');
  if (!local || !domain) return '***';
  return `${local.slice(0, 1)}***@${domain}`;
}

const STATUSES = new Set<string>(['pending', 'succeeded', 'failed', 'abandoned', 'refunded', 'needs_review']);
const DAY = /^\d{4}-\d{2}-\d{2}$/;

function cleanFilter(input: Partial<DonationFilter>): DonationFilter {
  const out: DonationFilter = { limit: LIST_LIMIT };
  if (input.status && STATUSES.has(input.status)) out.status = input.status;
  if (input.kind === 'one_time' || input.kind === 'monthly') out.kind = input.kind;
  if (input.from && DAY.test(input.from)) out.from = input.from;
  if (input.to && DAY.test(input.to)) out.to = input.to;
  return out;
}

const item = (d: AdminDonation): DonationListItem => ({
  id: d.id,
  reference: d.reference,
  status: d.status,
  kind: d.kind,
  currency: d.currency,
  expectedMinor: d.amountMinor,
  paidMinor: d.paidAmountMinor,
  test: d.siteMode === 'test',
  anonymous: d.anonymous,
  // An anonymous donor's name is hidden from every admin list and export, and shown nowhere else either.
  donorName: d.anonymous ? null : d.donorName,
  emailMasked: maskEmail(d.donorEmail),
  channel: d.channel,
  reviewReason: d.reviewReason,
  receiptQueued: d.receiptSentAt !== null,
  createdAt: d.createdAt,
  paidAt: d.paidAt,
});

/** Succeeded live gifts only, per currency. Test rows and open gifts never count, and currencies are never added together. */
export function summarize(rows: AdminDonation[]): Totals {
  const totals: Totals = {};
  for (const d of rows) {
    if (d.status !== 'succeeded' || d.siteMode !== 'live') continue;
    const t = (totals[d.currency] ??= { count: 0, minor: 0 });
    t.count += 1;
    t.minor += d.paidAmountMinor ?? d.amountMinor;
  }
  return totals;
}

const major = (minor: number | null) => (minor === null ? '' : (minor / 100).toFixed(2));
const lagosDay = (d: Date) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos' }).format(d);

/** One CSV cell. A leading = + - @ tab or return gets a quote so a spreadsheet never runs it as a formula. */
function cell(value: string): string {
  let text = value;
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export const DONATION_CSV_HEADER = [
  'reference', 'created', 'status', 'kind', 'currency', 'amount', 'paid_amount', 'mode', 'channel', 'name', 'email_masked', 'receipt_queued',
] as const;

export function donationsCsv(rows: AdminDonation[], opts: { masked: (email: string) => string }): string {
  const lines: string[] = [DONATION_CSV_HEADER.join(',')];
  for (const d of rows) {
    lines.push(
      [
        d.reference,
        lagosDay(d.createdAt),
        d.status,
        d.kind,
        d.currency,
        major(d.amountMinor),
        major(d.paidAmountMinor),
        d.siteMode,
        d.channel ?? '',
        d.anonymous ? '' : (d.donorName ?? ''),
        opts.masked(d.donorEmail),
        d.receiptSentAt ? 'yes' : 'no',
      ]
        .map(cell)
        .join(','),
    );
  }
  return `${lines.join('\n')}\n`;
}

const need = (actor: AdminActor) => {
  if (!isAdminRole(actor.role)) throw new Forbidden('Only an admin can see donations');
};

/** Donations for admins (M48-S36, S42). Editors have no access. Names and addresses are masked unless an admin reveals one, which is audited. */
export class DonationAdminService {
  constructor(private readonly deps: { store: DonationAdminStore; now?: () => Date }) {}

  async list(actor: AdminActor, input: Partial<DonationFilter>) {
    need(actor);
    const rows = await this.deps.store.list(cleanFilter(input));
    return { rows: rows.map(item), totals: summarize(rows) };
  }

  async get(actor: AdminActor, id: string): Promise<DonationListItem> {
    need(actor);
    const found = await this.deps.store.get(id);
    if (!found) throw new NotFound('Donation not found');
    return item(found);
  }

  async revealEmail(actor: AdminActor, id: string): Promise<string> {
    need(actor);
    const found = await this.deps.store.get(id);
    if (!found) throw new NotFound('Donation not found');
    // The address is not part of the audit row, only the fact that it was shown.
    await this.deps.store.audit({
      action: 'donation.reveal_email',
      actorAccountId: actor.accountId,
      actorRole: actor.role,
      targetType: 'donation',
      targetId: id,
      metadata: {},
    });
    return found.donorEmail;
  }

  async exportCsv(actor: AdminActor, input: Partial<DonationFilter>): Promise<{ csv: string; fileName: string }> {
    need(actor);
    const rows = await this.deps.store.list({ ...cleanFilter(input), limit: DONATION_EXPORT_MAX_ROWS + 1 });
    if (rows.length > DONATION_EXPORT_MAX_ROWS) {
      throw new ValidationFailed({ range: ['That is too many gifts to export. Choose a shorter range.'] }, 'Too large');
    }
    await this.deps.store.audit({
      action: 'donation.export',
      actorAccountId: actor.accountId,
      actorRole: actor.role,
      targetType: 'donation',
      targetId: null,
      metadata: { rows: rows.length },
    });
    return {
      csv: donationsCsv(rows, { masked: maskEmail }),
      fileName: `donations-${lagosDay((this.deps.now ?? (() => new Date()))())}.csv`,
    };
  }

  async resolveReview(actor: AdminActor, id: string, accept: boolean, note: string): Promise<void> {
    need(actor);
    const text = note.trim();
    if (!text) throw new ValidationFailed({ note: ['Write what you checked and why'] }, 'Note needed');
    if (text.length > 500) throw new ValidationFailed({ note: ['Keep the note under 500 characters'] }, 'Note too long');
    const found = await this.deps.store.get(id);
    if (!found) throw new NotFound('Donation not found');
    if (found.status !== 'needs_review') {
      throw new ValidationFailed({ status: ['This gift is not waiting for review'] }, 'Not in review');
    }
    if (!(await this.deps.store.resolve(id, accept, text))) {
      throw new ValidationFailed({ status: ['This gift is not waiting for review'] }, 'Not in review');
    }
    await this.deps.store.audit({
      action: 'donation.review_resolve',
      actorAccountId: actor.accountId,
      actorRole: actor.role,
      targetType: 'donation',
      targetId: id,
      metadata: { accepted: accept },
    });
  }
}
