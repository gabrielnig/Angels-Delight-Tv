import { sql } from 'drizzle-orm';
import { boolean, check, pgTable, primaryKey, text, uuid } from 'drizzle-orm/pg-core';
import { timestamptz, updatedAt } from './columns';
import { accounts } from './identity';

/**
 * What one person has done in the admin help centre (M50-S25, S26). One row per account and guide: when they marked
 * the guide done, when the video counted as watched, and their one tap answer to "Was this helpful". Nothing else is
 * stored. Owner only RLS, deleted with the account, listed in the data export.
 */
export const helpProgress = pgTable(
  'help_progress',
  {
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    articleId: text('article_id').notNull(),
    guideDoneAt: timestamptz('guide_done_at'),
    videoWatchedAt: timestamptz('video_watched_at'),
    helpful: boolean('helpful'),
    updatedAt: updatedAt(),
  },
  (t) => [
    primaryKey({ columns: [t.accountId, t.articleId] }),
    check('help_progress_article_shape', sql`${t.articleId} ~ '^[SDWCMKTR][0-9]{2}$'`),
  ],
);
