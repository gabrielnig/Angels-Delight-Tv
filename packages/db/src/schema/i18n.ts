import { sql } from 'drizzle-orm';
import {
  bigint,
  check,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { bytea, createdAt, pk, timestamptz, updatedAt } from './columns';
import { uiTranslationStatus } from './enums';
import { accounts } from './identity';

/**
 * Interface text edited in admin between releases (M46). `text` is a string, or an object keyed by CLDR plural
 * category. Viewers only ever see approved rows. `sourceHash` is the sha256 of the English text when translated.
 */
export const uiTranslations = pgTable(
  'ui_translations',
  {
    id: pk(),
    locale: text('locale').notNull(),
    key: text('key').notNull(),
    text: jsonb('text').$type<string | Record<string, string>>().notNull(),
    status: uiTranslationStatus('status').notNull().default('draft'),
    sourceHash: bytea('source_hash'),
    note: text('note'),
    updatedBy: uuid('updated_by').references(() => accounts.id, { onDelete: 'set null' }),
    reviewedBy: uuid('reviewed_by').references(() => accounts.id, { onDelete: 'set null' }),
    reviewedAt: timestamptz('reviewed_at'),
    updatedAt: updatedAt(),
    createdAt: createdAt(),
  },
  (t) => [
    unique('ui_translations_locale_key_uniq').on(t.locale, t.key),
    check('ui_translations_locale_known', sql`${t.locale} IN ('en', 'yo', 'ig', 'ha', 'pcm')`),
    check('ui_translations_key_length', sql`char_length(${t.key}) BETWEEN 3 AND 120`),
    index('ui_translations_locale_status_idx').on(t.locale, t.status),
  ],
);

/** Keys a viewer saw in English instead of their language. Written only through record_missing_key(). */
export const uiMissingKeys = pgTable(
  'ui_missing_keys',
  {
    locale: text('locale').notNull(),
    key: text('key').notNull(),
    hits: integer('hits').notNull().default(1),
    firstSeen: timestamptz('first_seen').notNull().defaultNow(),
    lastSeen: timestamptz('last_seen').notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.locale, t.key] })],
);

/** Characters sent to a paid translation provider per month, for the cost cap. */
export const translationUsage = pgTable(
  'translation_usage',
  {
    month: date('month').notNull(),
    provider: text('provider').notNull(),
    chars: bigint('chars', { mode: 'number' }).notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.month, t.provider] })],
);
