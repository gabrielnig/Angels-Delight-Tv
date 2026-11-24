import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  doublePrecision,
  index,
  integer,
  pgTable,
  smallint,
  text,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { timestamptz } from './columns';
import { series, videos } from './content';
import { profiles } from './identity';

/**
 * One rating per profile and title: -1 Not for me, 1 Like, 2 Love. Same shape as my_list, episodes roll up to the
 * series. Row level security and the kids trigger are in the migration (L5, M44).
 */
export const titleRatings = pgTable(
  'title_ratings',
  {
    profileId: uuid('profile_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    videoId: uuid('video_id').references(() => videos.id, { onDelete: 'cascade' }),
    seriesId: uuid('series_id').references(() => series.id, { onDelete: 'cascade' }),
    value: smallint('value').notNull(),
    ratedAt: timestamptz('rated_at').notNull().defaultNow(),
    updatedAt: timestamptz('updated_at').notNull().defaultNow(),
  },
  (t) => [
    check('title_ratings_value_known', sql`${t.value} IN (-1, 1, 2)`),
    check('title_ratings_exactly_one_target', sql`num_nonnulls(${t.videoId}, ${t.seriesId}) = 1`),
    uniqueIndex('title_ratings_profile_video_uniq')
      .on(t.profileId, t.videoId)
      .where(sql`${t.videoId} IS NOT NULL`),
    uniqueIndex('title_ratings_profile_series_uniq')
      .on(t.profileId, t.seriesId)
      .where(sql`${t.seriesId} IS NOT NULL`),
    index('title_ratings_video_idx').on(t.videoId),
    index('title_ratings_series_idx').on(t.seriesId),
  ],
);

/** Catalog level counts, written by the ratings rollup. No profile data, so no row level security. */
export const titleRatingStats = pgTable(
  'title_rating_stats',
  {
    videoId: uuid('video_id').references(() => videos.id, { onDelete: 'cascade' }),
    seriesId: uuid('series_id').references(() => series.id, { onDelete: 'cascade' }),
    dislikes: integer('dislikes').notNull().default(0),
    likes: integer('likes').notNull().default(0),
    loves: integer('loves').notNull().default(0),
    mostLiked: boolean('most_liked').notNull().default(false),
    updatedAt: timestamptz('updated_at').notNull().defaultNow(),
  },
  (t) => [
    check('title_rating_stats_exactly_one_target', sql`num_nonnulls(${t.videoId}, ${t.seriesId}) = 1`),
    uniqueIndex('title_rating_stats_video_uniq')
      .on(t.videoId)
      .where(sql`${t.videoId} IS NOT NULL`),
    uniqueIndex('title_rating_stats_series_uniq')
      .on(t.seriesId)
      .where(sql`${t.seriesId} IS NOT NULL`),
  ],
);

/**
 * The hourly trending and popular snapshot (L5, M44-S07). Global and unfiltered, top 60 per kind. Visibility and
 * maturity are applied when a row is read. Aggregate catalog data, so no row level security.
 */
export const titleScores = pgTable(
  'title_scores',
  {
    kind: text('kind').notNull(),
    videoId: uuid('video_id').references(() => videos.id, { onDelete: 'cascade' }),
    seriesId: uuid('series_id').references(() => series.id, { onDelete: 'cascade' }),
    score: doublePrecision('score').notNull(),
    plays: integer('plays').notNull(),
    rank: integer('rank').notNull(),
    computedAt: timestamptz('computed_at').notNull().defaultNow(),
  },
  (t) => [
    check('title_scores_kind_known', sql`${t.kind} IN ('trending', 'popular')`),
    check('title_scores_exactly_one_target', sql`num_nonnulls(${t.videoId}, ${t.seriesId}) = 1`),
    uniqueIndex('title_scores_kind_video_uniq')
      .on(t.kind, t.videoId)
      .where(sql`${t.videoId} IS NOT NULL`),
    uniqueIndex('title_scores_kind_series_uniq')
      .on(t.kind, t.seriesId)
      .where(sql`${t.seriesId} IS NOT NULL`),
    index('title_scores_kind_rank_idx').on(t.kind, t.rank),
  ],
);
