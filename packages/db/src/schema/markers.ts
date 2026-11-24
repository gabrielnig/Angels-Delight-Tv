import { sql } from 'drizzle-orm';
import { check, index, integer, pgTable, text, unique, uuid } from 'drizzle-orm/pg-core';
import { createdAt, pk, updatedAt } from './columns';
import { videos } from './content';
import { accounts } from './identity';

/**
 * Skip windows for one video (M43). One row per kind. A null `end_ms` on credits means "to the end of the
 * video", so a replaced video of a different length never leaves a stale end.
 */
export const videoMarkers = pgTable(
  'video_markers',
  {
    id: pk(),
    videoId: uuid('video_id')
      .notNull()
      .references(() => videos.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(),
    startMs: integer('start_ms').notNull(),
    endMs: integer('end_ms'),
    createdBy: uuid('created_by').references(() => accounts.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    unique('video_markers_video_kind_uniq').on(t.videoId, t.kind),
    check('video_markers_kind_known', sql`${t.kind} IN ('intro', 'recap', 'credits')`),
    check('video_markers_start_nonneg', sql`${t.startMs} >= 0`),
    check('video_markers_end_after_start', sql`${t.endMs} IS NULL OR ${t.endMs} > ${t.startMs}`),
    check('video_markers_end_required', sql`${t.kind} = 'credits' OR ${t.endMs} IS NOT NULL`),
  ],
);

/** Chapters of one video. Order is the order of `start_ms`, so there is no position column to keep in sync. */
export const videoChapters = pgTable(
  'video_chapters',
  {
    id: pk(),
    videoId: uuid('video_id')
      .notNull()
      .references(() => videos.id, { onDelete: 'cascade' }),
    startMs: integer('start_ms').notNull(),
    title: text('title').notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    unique('video_chapters_video_start_uniq').on(t.videoId, t.startMs),
    check('video_chapters_start_nonneg', sql`${t.startMs} >= 0`),
    check('video_chapters_title_length', sql`char_length(${t.title}) BETWEEN 1 AND 60`),
    index('video_chapters_video_idx').on(t.videoId, t.startMs),
  ],
);
