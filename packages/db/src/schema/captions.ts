import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  text,
  unique,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { bytea, createdAt, pk, timestamptz } from './columns';
import { captionSource, captionStatus } from './enums';
import { videos } from './content';
import { accounts } from './identity';

export const captionTracks = pgTable(
  'caption_tracks',
  {
    id: pk(),
    videoId: uuid('video_id')
      .notNull()
      .references(() => videos.id, { onDelete: 'cascade' }),
    language: text('language').notNull(),
    label: text('label').notNull(),
    kind: text('kind').notNull(),
    isDefault: boolean('is_default').notNull().default(false),
    // Circular with captions. Made DEFERRABLE by a hand-written migration.
    approvedCaptionId: uuid('approved_caption_id').references((): AnyPgColumn => captions.id, {
      onDelete: 'set null',
    }),
    createdAt: createdAt(),
  },
  (t) => [
    check('caption_tracks_kind_known', sql`${t.kind} IN ('captions', 'subtitles')`),
    check('caption_tracks_label_length', sql`char_length(${t.label}) BETWEEN 1 AND 40`),
    unique('caption_tracks_video_language_uniq').on(t.videoId, t.language),
    uniqueIndex('caption_tracks_one_default_uniq')
      .on(t.videoId)
      .where(sql`${t.isDefault}`),
  ],
);

export const captions = pgTable(
  'captions',
  {
    id: pk(),
    trackId: uuid('track_id')
      .notNull()
      .references(() => captionTracks.id, { onDelete: 'cascade' }),
    revision: integer('revision').notNull(),
    source: captionSource('source').notNull(),
    status: captionStatus('status').notNull().default('draft'),
    storageKey: text('storage_key').notNull(),
    publicKey: text('public_key'),
    sha256: bytea('sha256').notNull(),
    bytes: integer('bytes').notNull(),
    cueCount: integer('cue_count').notNull(),
    model: text('model'),
    createdBy: uuid('created_by').references(() => accounts.id, { onDelete: 'set null' }),
    reviewedBy: uuid('reviewed_by').references(() => accounts.id, { onDelete: 'set null' }),
    reviewedAt: timestamptz('reviewed_at'),
    reviewNote: text('review_note'),
    createdAt: createdAt(),
  },
  (t) => [
    check('captions_revision_positive', sql`${t.revision} >= 1`),
    check('captions_size_limit', sql`${t.bytes} BETWEEN 0 AND 1048576`),
    check(
      'captions_approved_is_reviewed',
      sql`${t.status} <> 'approved' OR (${t.reviewedBy} IS NOT NULL AND ${t.publicKey} IS NOT NULL)`,
    ),
    unique('captions_track_revision_uniq').on(t.trackId, t.revision),
    index('captions_track_status_idx').on(t.trackId, t.status),
  ],
);
