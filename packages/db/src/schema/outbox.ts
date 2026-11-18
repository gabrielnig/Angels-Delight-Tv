import { sql } from 'drizzle-orm';
import {
  check,
  index,
  jsonb,
  pgTable,
  smallint,
  text,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { bytea, createdAt, pk, timestamptz } from './columns';

export const OUTBOX_STATUSES = ['queued', 'sending', 'sent', 'failed'] as const;

/**
 * Mail waiting to be sent by the worker (M21-S01, M21-S03). The address is sealed with the field key, never stored
 * in the clear, and `vars` holds template values only (no codes or tokens: sign in and reset mail stays in the request, D-129).
 */
export const emailOutbox = pgTable(
  'email_outbox',
  {
    id: pk(),
    kind: text('kind').notNull(),
    /** Account the mail is for, kept without a foreign key so a deleted account does not block the log. */
    recipientId: uuid('recipient_id'),
    toEnc: bytea('to_enc').notNull(),
    vars: jsonb('vars').$type<Record<string, string | number>>().notNull().default({}),
    status: text('status').notNull().default('queued'),
    attempts: smallint('attempts').notNull().default(0),
    nextAttemptAt: timestamptz('next_attempt_at').notNull().defaultNow(),
    lockedUntil: timestamptz('locked_until'),
    providerMessageId: text('provider_message_id'),
    lastError: text('last_error'),
    /** One row per key, so a retried producer never queues the same mail twice. */
    dedupeKey: text('dedupe_key'),
    createdAt: createdAt(),
    sentAt: timestamptz('sent_at'),
  },
  (t) => [
    check('email_outbox_status_known', sql`${t.status} IN ('queued', 'sending', 'sent', 'failed')`),
    check('email_outbox_attempts_range', sql`${t.attempts} BETWEEN 0 AND 20`),
    index('email_outbox_due_idx')
      .on(t.nextAttemptAt)
      .where(sql`${t.status} IN ('queued', 'sending')`),
    uniqueIndex('email_outbox_dedupe_uniq')
      .on(t.dedupeKey)
      .where(sql`${t.dedupeKey} IS NOT NULL`),
  ],
);
