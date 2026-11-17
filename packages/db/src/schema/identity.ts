import { sql } from 'drizzle-orm';
import {
  boolean,
  bigint,
  check,
  doublePrecision,
  index,
  pgTable,
  smallint,
  text,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { accountRole, accountStatus, tokenPurpose } from './enums';
import { bytea, createdAt, pk, timestamptz, updatedAt } from './columns';

export const accounts = pgTable(
  'accounts',
  {
    id: pk(),
    emailHash: bytea('email_hash'),
    emailEnc: bytea('email_enc'),
    displayNameEnc: bytea('display_name_enc'),
    passwordHash: text('password_hash'),
    role: accountRole('role').notNull().default('viewer'),
    status: accountStatus('status').notNull().default('active'),
    emailVerifiedAt: timestamptz('email_verified_at'),
    locale: text('locale').notNull().default('en'),
    passwordChangedAt: timestamptz('password_changed_at').notNull().defaultNow(),
    lastLoginAt: timestamptz('last_login_at'),
    /** Why staff suspended this viewer. Shown to staff only. */
    suspendedReason: text('suspended_reason'),
    suspendedAt: timestamptz('suspended_at'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: timestamptz('deleted_at'),
  },
  (t) => [
    check(
      'accounts_deleted_consistent',
      sql`(${t.status} = 'deleted') = (${t.deletedAt} IS NOT NULL)`,
    ),
    check(
      'accounts_live_has_credentials',
      sql`${t.status} = 'deleted' OR (${t.emailHash} IS NOT NULL AND ${t.emailEnc} IS NOT NULL AND ${t.passwordHash} IS NOT NULL)`,
    ),
    check('accounts_locale_length', sql`char_length(${t.locale}) BETWEEN 2 AND 35`),
    uniqueIndex('accounts_email_hash_uniq')
      .on(t.emailHash)
      .where(sql`${t.emailHash} IS NOT NULL`),
    index('accounts_staff_role_idx')
      .on(t.role)
      .where(sql`${t.role} <> 'viewer'`),
    index('accounts_status_idx').on(t.status),
    index('accounts_created_idx').on(t.createdAt.desc(), t.id),
  ],
);

export const accountDeletions = pgTable(
  'account_deletions',
  {
    accountId: uuid('account_id').primaryKey(),
    requestedAt: timestamptz('requested_at').notNull(),
    mainDataPurgedAt: timestamptz('main_data_purged_at'),
    dekDestroyedAt: timestamptz('dek_destroyed_at'),
    backupsClearAfter: timestamptz('backups_clear_after'),
  },
  (t) => [
    index('account_deletions_pending_idx')
      .on(t.dekDestroyedAt)
      .where(sql`${t.dekDestroyedAt} IS NULL`),
  ],
);

export const profiles = pgTable(
  'profiles',
  {
    id: pk(),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    nameEnc: bytea('name_enc').notNull(),
    avatarId: text('avatar_id').notNull(),
    isKids: boolean('is_kids').notNull().default(false),
    isPrimary: boolean('is_primary').notNull().default(false),
    pinHash: text('pin_hash'),
    language: text('language').notNull().default('en'),
    autoplayNext: boolean('autoplay_next').notNull().default(true),
    dataSaver: boolean('data_saver').notNull().default(false),
    position: smallint('position').notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check('profiles_primary_not_kids', sql`NOT (${t.isPrimary} AND ${t.isKids})`),
    check('profiles_position_range', sql`${t.position} BETWEEN 0 AND 9`),
    index('profiles_account_position_idx').on(t.accountId, t.position),
    uniqueIndex('profiles_one_primary_uniq')
      .on(t.accountId)
      .where(sql`${t.isPrimary}`),
  ],
);

export const sessions = pgTable(
  'sessions',
  {
    id: pk(),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    tokenHash: bytea('token_hash').notNull(),
    createdAt: createdAt(),
    lastSeenAt: timestamptz('last_seen_at').notNull().defaultNow(),
    idleExpiresAt: timestamptz('idle_expires_at').notNull(),
    absoluteExpiresAt: timestamptz('absolute_expires_at').notNull(),
    revokedAt: timestamptz('revoked_at'),
    mfaVerifiedAt: timestamptz('mfa_verified_at'),
    reauthAt: timestamptz('reauth_at'),
    ipTrunc: text('ip_trunc'),
    userAgent: text('user_agent'),
  },
  (t) => [
    uniqueIndex('sessions_token_hash_uniq').on(t.tokenHash),
    index('sessions_active_by_account_idx')
      .on(t.accountId)
      .where(sql`${t.revokedAt} IS NULL`),
    index('sessions_absolute_expiry_idx').on(t.absoluteExpiresAt),
    check(
      'sessions_user_agent_length',
      sql`${t.userAgent} IS NULL OR char_length(${t.userAgent}) <= 200`,
    ),
  ],
);

export const emailTokens = pgTable(
  'email_tokens',
  {
    id: pk(),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    purpose: tokenPurpose('purpose').notNull(),
    tokenHash: bytea('token_hash').notNull(),
    newEmailEnc: bytea('new_email_enc'),
    newEmailHash: bytea('new_email_hash'),
    expiresAt: timestamptz('expires_at').notNull(),
    usedAt: timestamptz('used_at'),
    createdAt: createdAt(),
    ipTrunc: text('ip_trunc'),
  },
  (t) => [
    uniqueIndex('email_tokens_token_hash_uniq').on(t.tokenHash),
    index('email_tokens_unused_idx')
      .on(t.accountId, t.purpose)
      .where(sql`${t.usedAt} IS NULL`),
  ],
);

export const consents = pgTable(
  'consents',
  {
    id: pk(),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(),
    version: text('version').notNull(),
    grantedAt: timestamptz('granted_at').notNull(),
    revokedAt: timestamptz('revoked_at'),
    ipTrunc: text('ip_trunc'),
  },
  (t) => [
    check('consents_kind_known', sql`${t.kind} IN ('terms', 'privacy', 'guardian_declaration')`),
    uniqueIndex('consents_account_kind_version_uniq').on(t.accountId, t.kind, t.version),
  ],
);

export const mfaFactors = pgTable(
  'mfa_factors',
  {
    id: pk(),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    type: text('type').notNull().default('totp'),
    secretEnc: bytea('secret_enc').notNull(),
    confirmedAt: timestamptz('confirmed_at'),
    lastUsedStep: bigint('last_used_step', { mode: 'number' }),
    createdAt: createdAt(),
  },
  (t) => [
    check('mfa_factors_type_known', sql`${t.type} = 'totp'`),
    uniqueIndex('mfa_factors_account_type_uniq').on(t.accountId, t.type),
  ],
);

export const mfaRecoveryCodes = pgTable(
  'mfa_recovery_codes',
  {
    id: pk(),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    codeHash: bytea('code_hash').notNull(),
    usedAt: timestamptz('used_at'),
    createdAt: createdAt(),
  },
  (t) => [
    index('mfa_recovery_codes_unused_idx')
      .on(t.accountId)
      .where(sql`${t.usedAt} IS NULL`),
  ],
);

/** Created UNLOGGED by a hand-written migration. Data loss on crash is acceptable. */
export const rateLimitBuckets = pgTable(
  'rate_limit_buckets',
  {
    key: text('key').primaryKey(),
    tokens: doublePrecision('tokens').notNull(),
    updatedAt: timestamptz('updated_at').notNull().defaultNow(),
  },
  (t) => [index('rate_limit_buckets_updated_idx').on(t.updatedAt)],
);
