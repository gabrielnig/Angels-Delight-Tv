import { sql } from 'drizzle-orm';
import { watchProgress, withAccount } from '@ad/db';
import { isUuid, ValidationFailed, type Actor } from '@ad/shared';
import { playableVideoSql, rowsOf } from '@ad/catalog';
import { clockOf, rulesOf, spendAttempt, type ViewerContext } from './context';
import { isFinished } from './progress';
import { audienceOf, loadOwnedProfile } from './profiles';

/** Most entries one import takes. The device keeps at most 100 (R19). */
export const MAX_IMPORT_ITEMS = 100;

export interface ImportItem {
  videoId: string;
  positionMs: number;
  finished: boolean;
  /** When the device saved it, in epoch milliseconds. Never trusted past the server clock. */
  updatedAt: number;
}

export interface ImportInput {
  profileId: string;
  items: ImportItem[];
}

/**
 * Moves what a visitor watched on this device into a profile after they sign in (M40-S17). The account wins:
 * a video the profile already has progress for is left alone. Duration comes from the server, the video must be
 * published and in the profile's audience, positions under the start threshold are not worth keeping, and a
 * timestamp from the future is replaced by now. Only the signed in account's own profile can be written.
 */
export async function importGuestProgress(
  ctx: ViewerContext,
  actor: Actor,
  input: ImportInput,
): Promise<{ imported: number; skipped: number }> {
  if (input.items.length > MAX_IMPORT_ITEMS)
    throw new ValidationFailed({ items: [`Send at most ${MAX_IMPORT_ITEMS} videos`] });
  const rules = rulesOf(ctx);
  const now = clockOf(ctx);

  return withAccount(ctx.db, actor, async (tx) => {
    const profile = await loadOwnedProfile(tx, actor, input.profileId);
    await spendAttempt(ctx, 'progress', profile.id);

    const unique = new Map<string, ImportItem>();
    for (const item of input.items) if (isUuid(item.videoId)) unique.set(item.videoId, item);
    if (unique.size === 0) return { imported: 0, skipped: input.items.length };

    const ids = sql.join(
      [...unique.keys()].map((id) => sql`${id}::uuid`),
      sql`, `,
    );
    const found = rowsOf<{ id: string; duration_ms: number }>(
      await tx.execute(
        sql`SELECT v.id, v.duration_ms FROM videos v WHERE v.id IN (${ids}) AND ${playableVideoSql('v', audienceOf(profile), now)}`,
      ),
    );
    const durations = new Map(found.map((row) => [row.id, row.duration_ms]));

    let imported = 0;
    for (const [videoId, item] of unique) {
      const durationMs = durations.get(videoId);
      if (!durationMs || !Number.isFinite(item.positionMs)) continue;
      const positionMs = Math.min(Math.max(Math.trunc(item.positionMs), 0), durationMs);
      const finished = item.finished || isFinished(rules, positionMs, durationMs);
      if (!finished && positionMs < rules.minProgressMs) continue;
      const at = Number.isFinite(item.updatedAt)
        ? Math.min(item.updatedAt, now.getTime())
        : now.getTime();
      const timestamp = new Date(Math.max(at, 0));
      const saved = await tx
        .insert(watchProgress)
        .values({
          profileId: profile.id,
          videoId,
          positionMs: finished ? 0 : positionMs,
          durationMs,
          completed: finished,
          completedAt: finished ? timestamp : null,
          updatedAt: timestamp,
        })
        .onConflictDoNothing({ target: [watchProgress.profileId, watchProgress.videoId] })
        .returning({ id: watchProgress.videoId });
      imported += saved.length;
    }
    return { imported, skipped: input.items.length - imported };
  });
}
