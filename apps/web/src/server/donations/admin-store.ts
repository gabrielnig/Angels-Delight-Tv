import 'server-only';
import { writeAudit } from '@ad/audit';
import { withAccount, type Database } from '@ad/db';
import { openDonorField, type AdminDonation, type DonationAdminStore, type DonationAuditEntry, type DonationFilter } from '@ad/payments';
import type { Actor } from '@ad/shared';
import { sql, type SQL } from 'drizzle-orm';

type Tx = Database;
const rowsOf = <T>(result: unknown): T[] => {
  const r = (result as { rows?: unknown } | null)?.rows;
  return Array.isArray(r) ? (r as T[]) : Array.isArray(result) ? (result as T[]) : [];
};

interface Row {
  id: string;
  reference: string;
  status: AdminDonation['status'];
  kind: AdminDonation['kind'];
  currency: AdminDonation['currency'];
  amount_minor: string | number;
  paid_amount_minor: string | number | null;
  site_mode: 'test' | 'live';
  anonymous: boolean;
  donor_email_enc: Uint8Array;
  donor_name_enc: Uint8Array | null;
  channel: string | null;
  review_reason: string | null;
  receipt_sent_at: Date | string | null;
  created_at: Date | string;
  paid_at: Date | string | null;
}

const date = (v: Date | string | null) => (v === null ? null : v instanceof Date ? v : new Date(v));
const COLUMNS = sql`id, reference, status::text AS status, kind::text AS kind, currency, amount_minor, paid_amount_minor, site_mode, anonymous,
  donor_email_enc, donor_name_enc, channel, review_reason, receipt_sent_at, created_at, paid_at`;

/** Reads donations as one admin, so row level security decides who sees anything. Contact fields are opened here and masked by the service. */
export function createPgDonationAdminStore(db: Database, actor: Actor, kek: Uint8Array): DonationAdminStore {
  const run = <T>(fn: (tx: Tx) => Promise<T>): Promise<T> =>
    withAccount(db as never, actor, ((tx: unknown) => fn(tx as Tx)) as never) as Promise<T>;
  const open = (id: string, field: 'email' | 'name', bytes: Uint8Array): string => {
    try {
      return openDonorField(kek, id, field, new Uint8Array(bytes));
    } catch {
      return '';
    }
  };
  const toDonation = (r: Row): AdminDonation => ({
    id: r.id,
    reference: r.reference,
    status: r.status,
    kind: r.kind,
    currency: r.currency,
    amountMinor: Number(r.amount_minor),
    paidAmountMinor: r.paid_amount_minor === null ? null : Number(r.paid_amount_minor),
    siteMode: r.site_mode,
    anonymous: r.anonymous,
    donorName: r.donor_name_enc ? open(r.id, 'name', r.donor_name_enc) || null : null,
    donorEmail: open(r.id, 'email', r.donor_email_enc),
    channel: r.channel,
    reviewReason: r.review_reason,
    receiptSentAt: date(r.receipt_sent_at),
    createdAt: date(r.created_at) as Date,
    paidAt: date(r.paid_at),
  });
  return {
    async list(filter: DonationFilter) {
      const where: SQL[] = [];
      if (filter.status) where.push(sql`status = ${filter.status}::donation_status`);
      if (filter.kind) where.push(sql`kind = ${filter.kind}::donation_kind`);
      if (filter.from) where.push(sql`(created_at AT TIME ZONE 'Africa/Lagos')::date >= ${filter.from}::date`);
      if (filter.to) where.push(sql`(created_at AT TIME ZONE 'Africa/Lagos')::date <= ${filter.to}::date`);
      const clause = where.length ? sql`WHERE ${sql.join(where, sql` AND `)}` : sql``;
      const limit = Math.min(Math.max(filter.limit ?? 200, 1), 10_001);
      const found = rowsOf<Row>(
        await run((tx) => tx.execute(sql`SELECT ${COLUMNS} FROM donations ${clause} ORDER BY created_at DESC, id DESC LIMIT ${limit}`)),
      );
      return found.map(toDonation);
    },
    async get(id) {
      const found = rowsOf<Row>(await run((tx) => tx.execute(sql`SELECT ${COLUMNS} FROM donations WHERE id = ${id}::uuid`)));
      return found[0] ? toDonation(found[0]) : null;
    },
    async resolve(id, accept, note) {
      const out = rowsOf<{ ok: boolean }>(
        await run((tx) => tx.execute(sql`SELECT donation_review_resolve(${id}::uuid, ${accept}, ${note}) AS ok`)),
      );
      return out[0]?.ok === true;
    },
    async audit(entry: DonationAuditEntry) {
      await run((tx) =>
        writeAudit(tx, {
          action: entry.action,
          outcome: 'success',
          actorAccountId: entry.actorAccountId,
          actorRole: entry.actorRole,
          targetType: entry.targetType,
          targetId: entry.targetId,
          extra: entry.metadata,
        }),
      );
    },
  };
}
