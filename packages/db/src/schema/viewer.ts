import { sql } from 'drizzle-orm';
import { check, index, pgTable, primaryKey, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { createdAt, pk, slugCheck, timestamptz } from './columns';
import { series, videos } from './content';
import { profiles } from './identity';

/** Recent searches per profile (M06). `query` is stored trimmed and lowercased, so a repeat only refreshes the time. */
export const searchHistory = pgTable(
  'search_history',
  {
    profileId: uuid('profile_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    query: text('query').notNull(),
    searchedAt: timestamptz('searched_at').notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.profileId, t.query] }),
    check('search_history_query_length', sql`char_length(${t.query}) BETWEEN 2 AND 80`),
    index('search_history_recent_idx').on(t.profileId, t.searchedAt.desc()),
  ],
);

/** Old slugs that still resolve after a rename (M04-S02). Exactly one of the two targets is set. */
export const slugRedirects = pgTable(
  'slug_redirects',
  {
    id: pk(),
    oldSlug: text('old_slug').notNull(),
    videoId: uuid('video_id').references(() => videos.id, { onDelete: 'cascade' }),
    seriesId: uuid('series_id').references(() => series.id, { onDelete: 'cascade' }),
    createdAt: createdAt(),
  },
  (t) => [
    check('slug_redirects_slug_format', slugCheck('old_slug')),
    check('slug_redirects_exactly_one_target', sql`num_nonnulls(${t.videoId}, ${t.seriesId}) = 1`),
    uniqueIndex('slug_redirects_video_slug_uniq')
      .on(t.oldSlug)
      .where(sql`${t.videoId} IS NOT NULL`),
    uniqueIndex('slug_redirects_series_slug_uniq')
      .on(t.oldSlug)
      .where(sql`${t.seriesId} IS NOT NULL`),
  ],
);
