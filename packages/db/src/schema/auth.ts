import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  smallint,
  text,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { accountRole } from './enums';
import { bytea, createdAt, pk, timestamptz } from './columns';
import { accounts, emailTokens } from './identity';

/** Failure counters and temporary locks for sign in and second factor entry (lane B, M01-S07, M12-S01). */
export const authLockouts = pgTable(
  'auth_lockouts',
  {
    key: text('key').primaryKey(),
    failures: integer('failures').notNull().default(0),
    windowStartedAt: timestamptz('window_started_at').notNull(),
    lockedUntil: timestamptz('locked_until'),
    updatedAt: timestamptz('updated_at').notNull().defaultNow(),
  },
  (t) => [index('auth_lockouts_updated_idx').on(t.updatedAt)],
);

/** The 6 digit code that goes with a verification link. Stored as a keyed hash, never the digits. */
export const verificationCodes = pgTable('verification_codes', {
  tokenId: uuid('token_id')
    .primaryKey()
    .references(() => emailTokens.id, { onDelete: 'cascade' }),
  codeHash: bytea('code_hash').notNull(),
  attempts: smallint('attempts').notNull().default(0),
});

/** Pending staff invitations (M12-S05). The invitee has no account key yet, so the address is sealed with FIELD_KEK. */
export const adminInvites = pgTable(
  'admin_invites',
  {
    id: pk(),
    emailHash: bytea('email_hash').notNull(),
    emailEnc: bytea('email_enc').notNull(),
    role: accountRole('role').notNull(),
    tokenHash: bytea('token_hash').notNull(),
    invitedBy: uuid('invited_by').references(() => accounts.id, { onDelete: 'set null' }),
    expiresAt: timestamptz('expires_at').notNull(),
    acceptedAt: timestamptz('accepted_at'),
    revokedAt: timestamptz('revoked_at'),
    createdAt: createdAt(),
  },
  (t) => [
    check('admin_invites_staff_role', sql`${t.role}::text IN ('editor', 'admin', 'super_admin')`),
    uniqueIndex('admin_invites_token_hash_uniq').on(t.tokenHash),
    index('admin_invites_pending_idx')
      .on(t.emailHash)
      .where(sql`${t.acceptedAt} IS NULL AND ${t.revokedAt} IS NULL`),
  ],
);

/**
 * Sign up invite codes for a soft launch (M29-S03). Only the hash of a code is stored. `uses` counts accounts
 * created with it and is bumped by one conditional update, so a code cannot pass its limit under concurrency.
 */
export const signupInvites = pgTable(
  'signup_invites',
  {
    id: pk(),
    codeHash: bytea('code_hash').notNull(),
    /** The last characters of the code, so an admin can tell codes apart without seeing the code again. */
    hint: text('hint').notNull(),
    label: text('label').notNull().default(''),
    maxUses: integer('max_uses').notNull(),
    uses: integer('uses').notNull().default(0),
    expiresAt: timestamptz('expires_at'),
    revokedAt: timestamptz('revoked_at'),
    createdBy: uuid('created_by').references(() => accounts.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
  },
  (t) => [
    check('signup_invites_uses_in_range', sql`${t.uses} >= 0 AND ${t.uses} <= ${t.maxUses}`),
    check('signup_invites_max_uses_range', sql`${t.maxUses} BETWEEN 1 AND 1000`),
    uniqueIndex('signup_invites_code_hash_uniq').on(t.codeHash),
  ],
);

/**
 * Recent sign in attempts for one account (M49-S13, S14). Country only, never an address. Rows older than
 * `LOGIN_EVENT_RETENTION_DAYS` (90) are deleted by the maintenance job.
 */
export const loginEvents = pgTable(
  'login_events',
  {
    id: pk(),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    sessionId: uuid('session_id'),
    at: timestamptz('at').notNull().defaultNow(),
    outcome: text('outcome').notNull(),
    country: text('country'),
    ipTrunc: text('ip_trunc'),
    userAgent: text('user_agent'),
    deviceHash: bytea('device_hash'),
    newDevice: boolean('new_device').notNull().default(false),
  },
  (t) => [
    index('login_events_account_at_idx').on(t.accountId, t.at.desc()),
    index('login_events_at_idx').on(t.at),
    check(
      'login_events_outcome_known',
      sql`${t.outcome} IN ('success', 'failed', 'mfa_failed', 'locked')`,
    ),
    check('login_events_country_code', sql`${t.country} IS NULL OR char_length(${t.country}) = 2`),
  ],
);

/** A staff browser that passed the emailed code and was remembered (L16, D-397). Only a hash of the token is stored. */
export const trustedDevices = pgTable(
  'trusted_devices',
  {
    id: pk(),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    tokenHash: bytea('token_hash').notNull(),
    label: text('label').notNull(),
    country: text('country'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    lastUsedAt: timestamptz('last_used_at'),
    expiresAt: timestamptz('expires_at').notNull(),
    revokedAt: timestamptz('revoked_at'),
  },
  (t) => [
    uniqueIndex('trusted_devices_token_hash_uniq').on(t.tokenHash),
    index('trusted_devices_account_idx').on(t.accountId),
    check('trusted_devices_country_code', sql`${t.country} IS NULL OR char_length(${t.country}) = 2`),
    check('trusted_devices_expiry_after_creation', sql`${t.expiresAt} > ${t.createdAt}`),
  ],
);

/**
 * A sign in method linked to an account (M49-S05, S06). Only Google for now. The address is held as the keyed
 * lookup hash plus a masked hint, never in clear. `(provider, subject)` is the key: a change of address at Google
 * does not move the identity, and one identity belongs to one account.
 */
export const accountIdentities = pgTable(
  'account_identities',
  {
    id: pk(),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    provider: text('provider').notNull(),
    subject: text('subject').notNull(),
    emailHash: bytea('email_hash').notNull(),
    /** A masked address such as j***@gmail.com, for the Security screen. */
    emailHint: text('email_hint').notNull(),
    linkedAt: timestamptz('linked_at').notNull().defaultNow(),
    lastUsedAt: timestamptz('last_used_at'),
  },
  (t) => [
    check('account_identities_provider_known', sql`${t.provider} IN ('google')`),
    uniqueIndex('account_identities_provider_subject_uniq').on(t.provider, t.subject),
    uniqueIndex('account_identities_account_provider_uniq').on(t.accountId, t.provider),
  ],
);

