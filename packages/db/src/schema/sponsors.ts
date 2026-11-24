import { sql } from 'drizzle-orm';
import {
  check,
  date,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  uuid,
  boolean,
} from 'drizzle-orm/pg-core';
import { bytea, createdAt, pk, timestamptz, updatedAt } from './columns';
import { assets } from './content';
import { sponsorSlot, sponsorStatus } from './enums';
import { accounts } from './identity';

/**
 * A sponsor (M48). Public safe: nothing here is private, so a live row can be read by anyone. Contact and notes
 * live in sponsor_private. Scheduled, live and ended are derived from the dates, see sponsor_effective().
 */
export const sponsors = pgTable(
  'sponsors',
  {
    id: pk(),
    name: text('name').notNull(),
    status: sponsorStatus('status').notNull().default('draft'),
    startsAt: timestamptz('starts_at'),
    endsAt: timestamptz('ends_at'),
    createdBy: uuid('created_by').references(() => accounts.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check('sponsors_name', sql`char_length(${t.name}) BETWEEN 1 AND 80`),
    check('sponsors_window', sql`${t.endsAt} IS NULL OR ${t.startsAt} IS NULL OR ${t.endsAt} > ${t.startsAt}`),
    index('sponsors_status_idx').on(t.status),
  ],
);

/** Staff only: encrypted contact and internal notes. */
export const sponsorPrivate = pgTable(
  'sponsor_private',
  {
    sponsorId: uuid('sponsor_id')
      .primaryKey()
      .references(() => sponsors.id, { onDelete: 'cascade' }),
    contactNameEnc: bytea('contact_name_enc'),
    contactEmailEnc: bytea('contact_email_enc'),
    notes: text('notes'),
    updatedAt: updatedAt(),
  },
  (t) => [check('sponsor_private_notes', sql`${t.notes} IS NULL OR char_length(${t.notes}) <= 1000`)],
);

export const sponsorCreatives = pgTable(
  'sponsor_creatives',
  {
    id: pk(),
    sponsorId: uuid('sponsor_id')
      .notNull()
      .references(() => sponsors.id, { onDelete: 'cascade' }),
    headline: text('headline').notNull(),
    body: text('body'),
    ctaLabel: text('cta_label').notNull().default('Learn more'),
    destinationUrl: text('destination_url').notNull(),
    imageSquareAssetId: uuid('image_square_asset_id').references(() => assets.id, { onDelete: 'set null' }),
    imageWideAssetId: uuid('image_wide_asset_id').references(() => assets.id, { onDelete: 'set null' }),
    altText: text('alt_text'),
    weight: integer('weight').notNull().default(1),
    active: boolean('active').notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check('sponsor_creatives_headline', sql`char_length(${t.headline}) BETWEEN 1 AND 60`),
    check('sponsor_creatives_body', sql`${t.body} IS NULL OR char_length(${t.body}) <= 140`),
    check('sponsor_creatives_cta', sql`char_length(${t.ctaLabel}) BETWEEN 1 AND 24`),
    check('sponsor_creatives_alt', sql`${t.altText} IS NULL OR char_length(${t.altText}) <= 120`),
    check('sponsor_creatives_weight', sql`${t.weight} BETWEEN 1 AND 10`),
    check(
      'sponsor_creatives_destination',
      sql`${t.destinationUrl} ~ '^https://' AND char_length(${t.destinationUrl}) <= 500`,
    ),
    index('sponsor_creatives_sponsor_idx').on(t.sponsorId),
  ],
);

export const sponsorPlacements = pgTable(
  'sponsor_placements',
  {
    creativeId: uuid('creative_id')
      .notNull()
      .references(() => sponsorCreatives.id, { onDelete: 'cascade' }),
    slot: sponsorSlot('slot').notNull(),
  },
  (t) => [primaryKey({ columns: [t.creativeId, t.slot] })],
);

/**
 * Daily counters. No foreign key on the creative so a removed creative keeps its numbers, and the sponsor key
 * restricts deletion: a sponsor with numbers can only be archived. Written only through sponsor_stats_bump().
 */
export const sponsorDailyStats = pgTable(
  'sponsor_daily_stats',
  {
    day: date('day', { mode: 'string' }).notNull(),
    sponsorId: uuid('sponsor_id')
      .notNull()
      .references(() => sponsors.id, { onDelete: 'restrict' }),
    creativeId: uuid('creative_id').notNull(),
    slot: sponsorSlot('slot').notNull(),
    impressions: integer('impressions').notNull().default(0),
    clicks: integer('clicks').notNull().default(0),
    /** Distinct viewers that day for this creative. A daily figure, never added up as unique people. */
    reach: integer('reach').notNull().default(0),
  },
  (t) => [
    primaryKey({ columns: [t.day, t.creativeId, t.slot] }),
    check('sponsor_daily_stats_nonneg', sql`${t.impressions} >= 0 AND ${t.clicks} >= 0 AND ${t.reach} >= 0`),
    index('sponsor_daily_stats_sponsor_idx').on(t.sponsorId, t.day),
  ],
);
