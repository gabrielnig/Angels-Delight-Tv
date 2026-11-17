import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  char,
  check,
  date,
  index,
  integer,
  pgTable,
  primaryKey,
  smallint,
  text,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { pk, timestamptz, updatedAt } from './columns';
import { series, videos } from './content';
import { profiles } from './identity';

export const watchProgress = pgTable(
  'watch_progress',
  {
    profileId: uuid('profile_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    videoId: uuid('video_id')
      .notNull()
      .references(() => videos.id, { onDelete: 'cascade' }),
    positionMs: integer('position_ms').notNull(),
    durationMs: integer('duration_ms').notNull(),
    completed: boolean('completed').notNull().default(false),
    completedAt: timestamptz('completed_at'),
    updatedAt: updatedAt(),
  },
  (t) => [
    primaryKey({ columns: [t.profileId, t.videoId] }),
    check('watch_progress_position_nonnegative', sql`${t.positionMs} >= 0`),
    index('watch_progress_continue_idx')
      .on(t.profileId, t.updatedAt.desc())
      .where(sql`${t.completed} = false`),
  ],
);

export const myList = pgTable(
  'my_list',
  {
    id: pk(),
    profileId: uuid('profile_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    videoId: uuid('video_id').references(() => videos.id, { onDelete: 'cascade' }),
    seriesId: uuid('series_id').references(() => series.id, { onDelete: 'cascade' }),
    addedAt: timestamptz('added_at').notNull().defaultNow(),
  },
  (t) => [
    check('my_list_exactly_one_target', sql`num_nonnulls(${t.videoId}, ${t.seriesId}) = 1`),
    uniqueIndex('my_list_profile_video_uniq')
      .on(t.profileId, t.videoId)
      .where(sql`${t.videoId} IS NOT NULL`),
    uniqueIndex('my_list_profile_series_uniq')
      .on(t.profileId, t.seriesId)
      .where(sql`${t.seriesId} IS NOT NULL`),
    index('my_list_profile_added_idx').on(t.profileId, t.addedAt.desc(), t.id),
  ],
);

export const viewEvents = pgTable(
  'view_events',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    playId: uuid('play_id').notNull().unique(),
    videoId: uuid('video_id')
      .notNull()
      .references(() => videos.id, { onDelete: 'cascade' }),
    profileId: uuid('profile_id').references(() => profiles.id, { onDelete: 'set null' }),
    audience: text('audience').notNull(),
    startedAt: timestamptz('started_at').notNull(),
    watchedMs: integer('watched_ms').notNull(),
    completed: boolean('completed').notNull().default(false),
    maxHeight: smallint('max_height'),
    country: char('country', { length: 2 }),
    /** Daily rotating hash of the profile, null for kids. Cannot be joined across days (M19-S07). */
    viewerHash: text('viewer_hash'),
    deviceClass: text('device_class'),
    saveData: boolean('save_data'),
  },
  (t) => [
    check('view_events_audience_known', sql`${t.audience} IN ('general', 'kids')`),
    check(
      'view_events_device_known',
      sql`${t.deviceClass} IS NULL OR ${t.deviceClass} IN ('phone', 'tablet', 'desktop', 'tv', 'other')`,
    ),
    check(
      'view_events_kids_no_viewer_hash',
      sql`${t.audience} <> 'kids' OR ${t.viewerHash} IS NULL`,
    ),
    check('view_events_kids_anonymous', sql`${t.audience} <> 'kids' OR ${t.profileId} IS NULL`),
    index('view_events_video_started_idx').on(t.videoId, t.startedAt),
    index('view_events_started_idx').on(t.startedAt),
    index('view_events_viewer_idx').on(t.startedAt, t.viewerHash),
  ],
);

export const videoDailyStats = pgTable(
  'video_daily_stats',
  {
    videoId: uuid('video_id')
      .notNull()
      .references(() => videos.id, { onDelete: 'cascade' }),
    day: date('day', { mode: 'string' }).notNull(),
    views: integer('views').notNull().default(0),
    watchMs: bigint('watch_ms', { mode: 'number' }).notNull().default(0),
    completions: integer('completions').notNull().default(0),
    updatedAt: updatedAt(),
  },
  (t) => [primaryKey({ columns: [t.videoId, t.day] })],
);

/** One row per day, written by the nightly rollup. `uniques` counts daily rotating viewer hashes. */
export const siteDailyStats = pgTable('site_daily_stats', {
  day: date('day', { mode: 'string' }).primaryKey(),
  views: integer('views').notNull().default(0),
  uniques: integer('uniques').notNull().default(0),
  watchMs: bigint('watch_ms', { mode: 'number' }).notNull().default(0),
  completions: integer('completions').notNull().default(0),
  updatedAt: updatedAt(),
});

/** Small daily counters: device and connection splits, errors by code, vitals and startup buckets, empty searches. */
export const analyticsCounters = pgTable(
  'analytics_counters',
  {
    day: date('day', { mode: 'string' }).notNull(),
    kind: text('kind').notNull(),
    key: text('key').notNull(),
    count: bigint('count', { mode: 'number' }).notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.day, t.kind, t.key] })],
);
