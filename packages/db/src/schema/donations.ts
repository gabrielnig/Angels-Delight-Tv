import { sql } from 'drizzle-orm';
import { bigint, bigserial, check, index, integer, pgEnum, pgTable, text, uniqueIndex, uuid, boolean } from 'drizzle-orm/pg-core';
import { bytea, createdAt, pk, timestamptz, updatedAt } from './columns';
import { accounts } from './identity';

export const DONATION_KINDS = ['one_time', 'monthly'] as const;
export const DONATION_STATUSES = ['pending', 'succeeded', 'failed', 'abandoned', 'refunded', 'needs_review'] as const;
export const donationKind = pgEnum('donation_kind', DONATION_KINDS);
export const donationStatus = pgEnum('donation_status', DONATION_STATUSES);

/**
 * A donation (M48). Holds personal data, so the email, name and message are encrypted fields and the table is read
 * only by admins, or by the signed in donor for their own rows. Amounts are whole minor units (kobo, cents).
 * Rows are created and changed only by the checkout function and the worker, never by an admin screen.
 */
export const donations = pgTable(
  'donations',
  {
    id: pk(),
    reference: text('reference').notNull(),
    provider: text('provider').notNull().default('paystack'),
    providerTxnId: text('provider_txn_id'),
    kind: donationKind('kind').notNull().default('one_time'),
    status: donationStatus('status').notNull().default('pending'),
    currency: text('currency').notNull(),
    amountMinor: bigint('amount_minor', { mode: 'number' }).notNull(),
    /** What the provider says was paid. Differs from the amount asked for only when the gift needs review. */
    paidAmountMinor: bigint('paid_amount_minor', { mode: 'number' }),
    feeMinor: bigint('fee_minor', { mode: 'number' }),
    netMinor: bigint('net_minor', { mode: 'number' }),
    channel: text('channel'),
    donorEmailEnc: bytea('donor_email_enc').notNull(),
    donorEmailHash: bytea('donor_email_hash').notNull(),
    donorNameEnc: bytea('donor_name_enc'),
    messageEnc: bytea('message_enc'),
    anonymous: boolean('anonymous').notNull().default(false),
    accountId: uuid('account_id').references(() => accounts.id, { onDelete: 'set null' }),
    subscriptionId: uuid('subscription_id'),
    source: text('source').notNull().default('paystack'),
    siteMode: text('site_mode').notNull(),
    reviewReason: text('review_reason'),
    /** The browser's one time key for a checkout, so a double tap returns the first donation. */
    attemptKey: text('attempt_key'),
    /** The hosted Paystack page for a pending gift. Not a secret: it only lets someone pay. */
    checkoutUrl: text('checkout_url'),
    paidAt: timestamptz('paid_at'),
    receiptSentAt: timestamptz('receipt_sent_at'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('donations_reference_uq').on(t.reference),
    uniqueIndex('donations_attempt_key_uq').on(t.attemptKey).where(sql`${t.attemptKey} IS NOT NULL`),
    check('donations_amount_positive', sql`${t.amountMinor} > 0`),
    check('donations_paid_amount_positive', sql`${t.paidAmountMinor} IS NULL OR ${t.paidAmountMinor} > 0`),
    check('donations_currency_known', sql`${t.currency} IN ('NGN', 'USD')`),
    check('donations_source_known', sql`${t.source} IN ('paystack', 'manual')`),
    check('donations_site_mode_known', sql`${t.siteMode} IN ('test', 'live')`),
    index('donations_status_created_idx').on(t.status, t.createdAt),
    index('donations_email_hash_idx').on(t.donorEmailHash),
    index('donations_subscription_idx').on(t.subscriptionId),
    index('donations_account_idx').on(t.accountId),
  ],
);

/**
 * Raw webhook events, written only through `payment_event_insert()`. The payload is encrypted because it holds the
 * donor email, and is emptied after the retention days. The row stays so a late repeat is still recognised.
 */
export const paymentEvents = pgTable(
  'payment_events',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    provider: text('provider').notNull().default('paystack'),
    eventKey: text('event_key').notNull(),
    eventType: text('event_type').notNull(),
    reference: text('reference'),
    payloadEnc: bytea('payload_enc'),
    receivedAt: timestamptz('received_at').notNull().defaultNow(),
    processedAt: timestamptz('processed_at'),
    outcome: text('outcome'),
    error: text('error'),
    attempts: integer('attempts').notNull().default(0),
  },
  (t) => [
    uniqueIndex('payment_events_key_uq').on(t.provider, t.eventKey),
    index('payment_events_unprocessed_idx').on(t.receivedAt).where(sql`${t.processedAt} IS NULL`),
    index('payment_events_reference_idx').on(t.reference),
  ],
);
