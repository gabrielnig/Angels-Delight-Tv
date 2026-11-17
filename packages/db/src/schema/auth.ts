import { sql } from 'drizzle-orm';
import {
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
    check('admin_invites_staff_role', sql`${t.role} IN ('editor', 'admin')`),
    uniqueIndex('admin_invites_token_hash_uniq').on(t.tokenHash),
    index('admin_invites_pending_idx')
      .on(t.emailHash)
      .where(sql`${t.acceptedAt} IS NULL AND ${t.revokedAt} IS NULL`),
  ],
);
