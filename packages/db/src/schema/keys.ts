import { smallint, pgTable, uuid } from 'drizzle-orm/pg-core';
import { bytea, timestamptz } from './columns';

/** Lives in the separate ad_keys database, so it has its own migrations and no foreign keys. */
export const userKeys = pgTable('user_keys', {
  accountId: uuid('account_id').primaryKey(),
  dekWrapped: bytea('dek_wrapped').notNull(),
  kekVersion: smallint('kek_version').notNull(),
  createdAt: timestamptz('created_at').notNull().defaultNow(),
});
