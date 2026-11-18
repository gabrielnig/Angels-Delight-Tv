import { sql } from 'drizzle-orm';
import { boolean, check, index, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { bytea, createdAt, pk, timestamptz, updatedAt } from './columns';
import { accounts } from './identity';
import { videos } from './content';

/**
 * One in-app notice per staff recipient (M21-S03). Read state is per person, so marking all read for one admin
 * never clears the bell for another.
 */
export const adminNotices = pgTable(
  'admin_notices',
  {
    id: pk(),
    recipientId: uuid('recipient_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(),
    title: text('title').notNull(),
    body: text('body').notNull().default(''),
    href: text('href'),
    videoId: uuid('video_id').references(() => videos.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
    readAt: timestamptz('read_at'),
    /** Set when the notice went into an email, so a summary never lists it twice. */
    emailedAt: timestamptz('emailed_at'),
  },
  (t) => [
    index('admin_notices_recipient_created_idx').on(t.recipientId, t.createdAt),
    check(
      'admin_notices_kind_known',
      sql`${t.kind} IN ('encode_done', 'encode_failed', 'captions_ready', 'captions_failed')`,
    ),
  ],
);

/** Which emails an admin wants (M21-S05). Security email is not listed here because it cannot be turned off. */
export const NOTICE_EMAIL_FREQUENCIES = ['immediate', 'hourly', 'daily'] as const;

export const staffNotificationPrefs = pgTable(
  'staff_notification_prefs',
  {
    accountId: uuid('account_id')
      .primaryKey()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    failures: boolean('failures').notNull().default(true),
    captionsReady: boolean('captions_ready').notNull().default(false),
    dailySummary: boolean('daily_summary').notNull().default(false),
    /** When emails for failures and captions go out: at once, in an hourly summary or in the daily one (M21-S03). */
    emailFrequency: text('email_frequency').notNull().default('hourly'),
    /** The staff address sealed with the field key, so the worker can mail it without reading `accounts` (D-129). */
    addressEnc: bytea('address_enc'),
    updatedAt: updatedAt(),
  },
  (t) => [
    check(
      'staff_notification_prefs_frequency_known',
      sql`${t.emailFrequency} IN ('immediate', 'hourly', 'daily')`,
    ),
  ],
);

/**
 * Addresses that bounced or complained (M21-S01 AC2). Stored as a keyed hash, never the address, so the list
 * holds no personal data. Non essential mail to these addresses is skipped.
 */
export const emailSuppressions = pgTable(
  'email_suppressions',
  {
    emailHash: text('email_hash').primaryKey(),
    reason: text('reason').notNull(),
    createdAt: createdAt(),
  },
  (t) => [check('email_suppressions_reason_known', sql`${t.reason} IN ('bounce', 'complaint')`)],
);
