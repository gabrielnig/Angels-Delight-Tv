import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  smallint,
  text,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import {
  bytea,
  citext,
  createdAt,
  pk,
  slugCheck,
  timestamptz,
  tsvector,
  updatedAt,
} from './columns';
import {
  assetPurpose,
  assetStatus,
  publishState,
  renditionStatus,
  rowKind,
  videoKind,
  videoStatus,
} from './enums';
import { accounts } from './identity';

export const assets = pgTable(
  'assets',
  {
    id: pk(),
    purpose: assetPurpose('purpose').notNull(),
    status: assetStatus('status').notNull().default('processing'),
    rawKey: text('raw_key'),
    mediaKeyBase: text('media_key_base'),
    variants: jsonb('variants')
      .$type<
        { width: number; height: number; key: string; bytes: number; format?: 'webp' | 'jpeg' }[]
      >()
      .notNull()
      .default(sql`'[]'::jsonb`),
    mime: text('mime').notNull(),
    bytes: integer('bytes'),
    width: integer('width'),
    height: integer('height'),
    sha256: bytea('sha256'),
    placeholderColor: text('placeholder_color'),
    altText: text('alt_text'),
    createdBy: uuid('created_by').references(() => accounts.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
  },
  (t) => [
    check('assets_mime_allowed', sql`${t.mime} IN ('image/webp', 'image/jpeg', 'image/png')`),
    check('assets_alt_text_length', sql`${t.altText} IS NULL OR char_length(${t.altText}) <= 200`),
    index('assets_purpose_created_idx').on(t.purpose, t.createdAt.desc()),
    index('assets_sha256_idx').on(t.sha256),
  ],
);

export const videos = pgTable(
  'videos',
  {
    id: pk(),
    slug: text('slug').notNull(),
    title: text('title').notNull(),
    description: text('description'),
    kind: videoKind('kind').notNull().default('standalone'),
    status: videoStatus('status').notNull().default('uploading'),
    publishState: publishState('publish_state').notNull().default('draft'),
    publishAt: timestamptz('publish_at'),
    publishedAt: timestamptz('published_at'),
    kidsSafe: boolean('kids_safe').notNull().default(false),
    language: text('language').notNull().default('en'),
    durationMs: integer('duration_ms'),
    width: smallint('width'),
    height: smallint('height'),
    originalKey: text('original_key'),
    originalBytes: bigint('original_bytes', { mode: 'number' }),
    originalSha256: bytea('original_sha256'),
    mediaPrefix: text('media_prefix').notNull().unique(),
    posterAssetId: uuid('poster_asset_id').references(() => assets.id, { onDelete: 'set null' }),
    heroAssetId: uuid('hero_asset_id').references(() => assets.id, { onDelete: 'set null' }),
    failureCode: text('failure_code'),
    failureMessage: text('failure_message'),
    /** Key in the media bucket of the seek preview map (WebVTT pointing at sprite sheets). Null when none. */
    spriteKey: text('sprite_key'),
    /** Free tags set by editors. Shown on the admin edit screen only. */
    tags: text('tags')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    /** Who the editor says this is for. kidsSafe is true for 'kids' and 'everyone'. */
    suitability: text('suitability'),
    /** Set when an admin published without approved captions. Audited at the same time. */
    captionOverrideReason: text('caption_override_reason'),
    /** Poster crop chosen in the poster picker: focus x and y in percent, zoom from 100 to 200 percent. */
    posterFocus: jsonb('poster_focus').$type<{ x: number; y: number; zoom: number }>(),
    createdBy: uuid('created_by').references(() => accounts.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: timestamptz('deleted_at'),
    searchTsv: tsvector('search_tsv').generatedAlwaysAs(
      sql`to_tsvector('simple', title || ' ' || coalesce(description, ''))`,
    ),
  },
  (t) => [
    check('videos_slug_format', slugCheck('slug')),
    check(
      'videos_suitability_known',
      sql`${t.suitability} IS NULL OR ${t.suitability} IN ('everyone', 'kids', 'older')`,
    ),
    check('videos_tags_count', sql`cardinality(${t.tags}) <= 10`),
    check('videos_title_length', sql`char_length(${t.title}) BETWEEN 1 AND 200`),
    check(
      'videos_description_length',
      sql`${t.description} IS NULL OR char_length(${t.description}) <= 5000`,
    ),
    check(
      'videos_scheduled_has_time',
      sql`${t.publishState} <> 'scheduled' OR ${t.publishAt} IS NOT NULL`,
    ),
    check(
      'videos_published_is_ready',
      sql`${t.publishState} NOT IN ('scheduled', 'published') OR ${t.status} = 'ready'`,
    ),
    // IS NOT NULL is explicit: a NULL duration makes `> 0` NULL, which a CHECK treats as passing.
    check(
      'videos_ready_has_duration',
      sql`${t.status} <> 'ready' OR (${t.durationMs} IS NOT NULL AND ${t.durationMs} > 0)`,
    ),
    unique('videos_id_kind_uniq').on(t.id, t.kind),
    uniqueIndex('videos_slug_live_uniq')
      .on(t.slug)
      .where(sql`${t.deletedAt} IS NULL`),
    index('videos_publish_idx').on(t.publishState, t.publishedAt.desc(), t.id),
    index('videos_search_idx').using('gin', t.searchTsv),
    index('videos_title_trgm_idx').using('gin', t.title.op('gin_trgm_ops')),
    index('videos_processing_idx')
      .on(t.status)
      .where(sql`${t.status} <> 'ready'`),
    index('videos_created_idx').on(t.createdAt.desc(), t.id),
  ],
);

export const videoKeys = pgTable('video_keys', {
  videoId: uuid('video_id')
    .primaryKey()
    .references(() => videos.id, { onDelete: 'cascade' }),
  keyWrapped: bytea('key_wrapped').notNull(),
  kekVersion: smallint('kek_version').notNull(),
  createdAt: createdAt(),
  rotatedAt: timestamptz('rotated_at'),
});

export const renditions = pgTable(
  'renditions',
  {
    id: pk(),
    videoId: uuid('video_id')
      .notNull()
      .references(() => videos.id, { onDelete: 'cascade' }),
    height: smallint('height').notNull(),
    width: smallint('width').notNull(),
    videoKbps: integer('video_kbps').notNull(),
    audioKbps: integer('audio_kbps').notNull(),
    bandwidthBps: integer('bandwidth_bps'),
    avgBandwidthBps: integer('avg_bandwidth_bps'),
    codecs: text('codecs'),
    segmentCount: integer('segment_count'),
    segmentSeconds: numeric('segment_seconds', { precision: 4, scale: 2 })
      .notNull()
      .default('6.00'),
    totalBytes: bigint('total_bytes', { mode: 'number' }),
    templateKey: text('template_key'),
    status: renditionStatus('status').notNull().default('pending'),
    errorMessage: text('error_message'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check('renditions_height_range', sql`${t.height} BETWEEN 144 AND 2160`),
    unique('renditions_video_height_uniq').on(t.videoId, t.height),
    index('renditions_video_idx').on(t.videoId),
  ],
);

export const series = pgTable(
  'series',
  {
    id: pk(),
    slug: text('slug').notNull(),
    title: text('title').notNull(),
    description: text('description'),
    kidsSafe: boolean('kids_safe').notNull().default(false),
    posterAssetId: uuid('poster_asset_id').references(() => assets.id, { onDelete: 'set null' }),
    heroAssetId: uuid('hero_asset_id').references(() => assets.id, { onDelete: 'set null' }),
    publishState: publishState('publish_state').notNull().default('draft'),
    publishAt: timestamptz('publish_at'),
    publishedAt: timestamptz('published_at'),
    createdBy: uuid('created_by').references(() => accounts.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: timestamptz('deleted_at'),
    searchTsv: tsvector('search_tsv').generatedAlwaysAs(
      sql`to_tsvector('simple', title || ' ' || coalesce(description, ''))`,
    ),
  },
  (t) => [
    check('series_slug_format', slugCheck('slug')),
    check('series_title_length', sql`char_length(${t.title}) BETWEEN 1 AND 200`),
    check(
      'series_description_length',
      sql`${t.description} IS NULL OR char_length(${t.description}) <= 5000`,
    ),
    check(
      'series_scheduled_has_time',
      sql`${t.publishState} <> 'scheduled' OR ${t.publishAt} IS NOT NULL`,
    ),
    uniqueIndex('series_slug_live_uniq')
      .on(t.slug)
      .where(sql`${t.deletedAt} IS NULL`),
    index('series_publish_idx').on(t.publishState, t.publishedAt.desc(), t.id),
    index('series_search_idx').using('gin', t.searchTsv),
    index('series_title_trgm_idx').using('gin', t.title.op('gin_trgm_ops')),
  ],
);

export const seasons = pgTable(
  'seasons',
  {
    id: pk(),
    seriesId: uuid('series_id')
      .notNull()
      .references(() => series.id, { onDelete: 'cascade' }),
    number: smallint('number').notNull(),
    title: text('title'),
  },
  (t) => [
    check('seasons_number_positive', sql`${t.number} >= 1`),
    unique('seasons_series_number_uniq').on(t.seriesId, t.number),
  ],
);

export const episodes = pgTable(
  'episodes',
  {
    id: pk(),
    seasonId: uuid('season_id')
      .notNull()
      .references(() => seasons.id, { onDelete: 'cascade' }),
    videoId: uuid('video_id').notNull().unique(),
    videoKind: videoKind('video_kind').notNull().default('episode'),
    number: smallint('number').notNull(),
  },
  (t) => [
    check('episodes_video_is_episode_kind', sql`${t.videoKind} = 'episode'`),
    check('episodes_number_positive', sql`${t.number} >= 1`),
    foreignKey({
      name: 'episodes_video_kind_fk',
      columns: [t.videoId, t.videoKind],
      foreignColumns: [videos.id, videos.kind],
    }),
    unique('episodes_season_number_uniq').on(t.seasonId, t.number),
    index('episodes_season_number_idx').on(t.seasonId, t.number),
  ],
);

export const categories = pgTable(
  'categories',
  {
    id: pk(),
    slug: text('slug').notNull().unique(),
    name: citext('name').notNull().unique(),
    description: text('description'),
    position: integer('position').notNull().default(0),
    isVisible: boolean('is_visible').notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check('categories_slug_format', slugCheck('slug')),
    check('categories_name_length', sql`char_length(${t.name}) BETWEEN 1 AND 60`),
    index('categories_position_idx').on(t.position),
  ],
);

export const videoCategories = pgTable(
  'video_categories',
  {
    videoId: uuid('video_id')
      .notNull()
      .references(() => videos.id, { onDelete: 'cascade' }),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => categories.id, { onDelete: 'cascade' }),
  },
  (t) => [
    primaryKey({ columns: [t.videoId, t.categoryId] }),
    index('video_categories_by_category_idx').on(t.categoryId, t.videoId),
  ],
);

export const seriesCategories = pgTable(
  'series_categories',
  {
    seriesId: uuid('series_id')
      .notNull()
      .references(() => series.id, { onDelete: 'cascade' }),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => categories.id, { onDelete: 'cascade' }),
  },
  (t) => [
    primaryKey({ columns: [t.seriesId, t.categoryId] }),
    index('series_categories_by_category_idx').on(t.categoryId, t.seriesId),
  ],
);

export const rows = pgTable(
  'rows',
  {
    id: pk(),
    title: text('title').notNull(),
    kind: rowKind('kind').notNull().default('curated'),
    categoryId: uuid('category_id').references(() => categories.id, { onDelete: 'set null' }),
    /** A curated row that shows the episodes of one series, read from the episodes each time (M17-S02). */
    seriesId: uuid('series_id').references(() => series.id, { onDelete: 'set null' }),
    position: integer('position').notNull(),
    isPublished: boolean('is_published').notNull().default(false),
    kidsVisible: boolean('kids_visible').notNull().default(false),
    maxItems: smallint('max_items').notNull().default(20),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check('rows_title_length', sql`char_length(${t.title}) BETWEEN 1 AND 80`),
    check(
      'rows_category_kind_has_category',
      sql`${t.kind} <> 'category' OR ${t.categoryId} IS NOT NULL`,
    ),
    check('rows_max_items_range', sql`${t.maxItems} BETWEEN 1 AND 50`),
    // Made DEFERRABLE INITIALLY DEFERRED by a hand-written migration so a reorder is one transaction.
    unique('rows_position_uniq').on(t.position),
  ],
);

export const rowItems = pgTable(
  'row_items',
  {
    id: pk(),
    rowId: uuid('row_id')
      .notNull()
      .references(() => rows.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    videoId: uuid('video_id').references(() => videos.id, { onDelete: 'cascade' }),
    seriesId: uuid('series_id').references(() => series.id, { onDelete: 'cascade' }),
  },
  (t) => [
    check('row_items_exactly_one_target', sql`num_nonnulls(${t.videoId}, ${t.seriesId}) = 1`),
    // Deferrable like rows_position_uniq.
    unique('row_items_row_position_uniq').on(t.rowId, t.position),
    uniqueIndex('row_items_row_video_uniq')
      .on(t.rowId, t.videoId)
      .where(sql`${t.videoId} IS NOT NULL`),
    uniqueIndex('row_items_row_series_uniq')
      .on(t.rowId, t.seriesId)
      .where(sql`${t.seriesId} IS NOT NULL`),
    index('row_items_row_position_idx').on(t.rowId, t.position),
  ],
);
