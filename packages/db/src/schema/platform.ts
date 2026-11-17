import { sql } from 'drizzle-orm';
import {
  bigint,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  uniqueIndex,
  uuid,
  boolean,
} from 'drizzle-orm/pg-core';
import { createdAt, pk, timestamptz } from './columns';
import { themeStatus } from './enums';
import { assets } from './content';
import { accounts } from './identity';

export const themeSettings = pgTable(
  'theme_settings',
  {
    id: pk(),
    status: themeStatus('status').notNull(),
    version: integer('version').notNull(),
    tokens: jsonb('tokens').$type<Record<string, unknown>>().notNull(),
    logoAssetId: uuid('logo_asset_id').references(() => assets.id, { onDelete: 'set null' }),
    faviconAssetId: uuid('favicon_asset_id').references(() => assets.id, { onDelete: 'set null' }),
    createdBy: uuid('created_by').references(() => accounts.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
    publishedAt: timestamptz('published_at'),
  },
  (t) => [
    check('theme_settings_tokens_size', sql`pg_column_size(${t.tokens}) < 16384`),
    uniqueIndex('theme_settings_one_published_uniq')
      .on(t.status)
      .where(sql`${t.status} = 'published'`),
    uniqueIndex('theme_settings_one_draft_uniq')
      .on(t.status)
      .where(sql`${t.status} = 'draft'`),
    uniqueIndex('theme_settings_version_uniq').on(t.version),
  ],
);

export const settings = pgTable(
  'settings',
  {
    key: text('key').primaryKey(),
    value: jsonb('value').$type<unknown>().notNull(),
    description: text('description'),
    isPublic: boolean('is_public').notNull().default(false),
    updatedBy: uuid('updated_by').references(() => accounts.id, { onDelete: 'set null' }),
    updatedAt: timestamptz('updated_at').notNull().defaultNow(),
  },
  (t) => [check('settings_key_format', sql`${t.key} ~ '^[a-z][a-z0-9_.]{1,63}$'`)],
);

/** Append only. A trigger in the hand-written migrations rejects UPDATE, DELETE and TRUNCATE. */
export const auditLog = pgTable(
  'audit_log',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    occurredAt: timestamptz('occurred_at').notNull().defaultNow(),
    actorAccountId: uuid('actor_account_id'),
    actorRole: text('actor_role'),
    action: text('action').notNull(),
    targetType: text('target_type'),
    targetId: text('target_id'),
    outcome: text('outcome').notNull(),
    ipTrunc: text('ip_trunc'),
    requestId: text('request_id'),
    metadata: jsonb('metadata')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
  },
  (t) => [
    check('audit_log_outcome_known', sql`${t.outcome} IN ('success', 'denied', 'failure')`),
    index('audit_log_occurred_idx').on(t.occurredAt.desc()),
    index('audit_log_actor_idx').on(t.actorAccountId, t.occurredAt.desc()),
    index('audit_log_action_idx').on(t.action, t.occurredAt.desc()),
    index('audit_log_target_idx').on(t.targetType, t.targetId),
  ],
);
