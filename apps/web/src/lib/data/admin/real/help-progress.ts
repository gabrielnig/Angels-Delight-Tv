import 'server-only';
import { schema, withAccount } from '@ad/db';
import { eq, sql } from 'drizzle-orm';
import { adminRuntime } from '@/server/admin/runtime';
import { assertGuide, type HelpProgressService, type ProgressRows } from '../help-progress';
import { catalogActor } from './shared';

type Column = 'guide_done_at' | 'video_watched_at' | 'helpful';

/** One upsert per tap. The row is the account's own (RLS), so another account's progress is out of reach. */
async function upsert(
  actor: Parameters<HelpProgressService['read']>[0],
  guide: string,
  column: Column,
  value: ReturnType<typeof sql>,
): Promise<void> {
  assertGuide(guide);
  await withAccount(adminRuntime().db(), catalogActor(actor), async (tx) => {
    await tx.execute(sql`
      INSERT INTO help_progress (account_id, article_id, ${sql.raw(column)})
      VALUES (${actor.accountId}::uuid, ${guide}, ${value})
      ON CONFLICT (account_id, article_id)
      DO UPDATE SET ${sql.raw(column)} = EXCLUDED.${sql.raw(column)}, updated_at = now()`);
  });
}

export const realHelpProgress: HelpProgressService = {
  async read(actor) {
    const rows = await withAccount(adminRuntime().db(), catalogActor(actor), (tx) =>
      tx
        .select()
        .from(schema.helpProgress)
        .where(eq(schema.helpProgress.accountId, actor.accountId)),
    );
    const out: ProgressRows = {};
    for (const r of rows) {
      out[r.articleId] = {
        done: r.guideDoneAt !== null,
        watched: r.videoWatchedAt !== null,
        helpful: r.helpful,
      };
    }
    return out;
  },
  setGuideDone: (actor, guide, done) =>
    upsert(actor, guide, 'guide_done_at', done ? sql`now()` : sql`NULL::timestamptz`),
  markVideoWatched: (actor, guide) => upsert(actor, guide, 'video_watched_at', sql`now()`),
  setHelpful: (actor, guide, helpful) => upsert(actor, guide, 'helpful', sql`${helpful}::boolean`),
};
