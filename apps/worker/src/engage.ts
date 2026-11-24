import type { Database } from '@ad/db';
import { sql } from 'drizzle-orm';

/** The Most liked rules (M44-S05). Defaults here, the settings registry can override them later. */
export interface RatingRules {
  minRaters: number;
  minPositiveShare: number;
  /** Hard cap on how many titles carry the label. */
  maxLabelled: number;
  /** The label goes to this share of eligible titles, at least one. */
  labelFraction: number;
}

export const DEFAULT_RATING_RULES: RatingRules = {
  minRaters: 10,
  minPositiveShare: 0.85,
  maxLabelled: 10,
  labelFraction: 0.25,
};

export interface RatingCounts {
  /** `video:<id>` or `series:<id>`. */
  key: string;
  likes: number;
  loves: number;
  dislikes: number;
}

/** Lower end of the 95 percent Wilson interval of the positive share. Rewards both share and evidence. */
export function wilsonLowerBound(positive: number, total: number): number {
  if (total <= 0) return 0;
  const z = 1.96;
  const p = positive / total;
  const denominator = 1 + (z * z) / total;
  const centre = p + (z * z) / (2 * total);
  const margin = z * Math.sqrt((p * (1 - p) + (z * z) / (4 * total)) / total);
  return Math.max(0, (centre - margin) / denominator);
}

/** The keys that earn the Most liked label. A title below the minimum raters never does. */
export function pickMostLiked(rows: readonly RatingCounts[], rules: RatingRules): Set<string> {
  const eligible = rows
    .map((row) => {
      const total = row.likes + row.loves + row.dislikes;
      const positive = row.likes + row.loves;
      return { key: row.key, total, positive, loves: row.loves };
    })
    .filter((r) => r.total >= rules.minRaters && r.positive / r.total >= rules.minPositiveShare);
  if (eligible.length === 0) return new Set();
  const ranked = eligible
    .map((r) => ({
      key: r.key,
      score: wilsonLowerBound(r.positive, r.total),
      lovesShare: r.loves / r.total,
    }))
    .sort((a, b) => b.score - a.score || b.lovesShare - a.lovesShare || a.key.localeCompare(b.key));
  const count = Math.max(
    1,
    Math.min(rules.maxLabelled, Math.floor(eligible.length * rules.labelFraction)),
  );
  return new Set(ranked.slice(0, count).map((r) => r.key));
}

interface AggregateRow {
  video_id: string | null;
  series_id: string | null;
  likes: number;
  loves: number;
  dislikes: number;
}

/**
 * Rebuilds `title_rating_stats` from the aggregate function and recomputes the Most liked flags. Idempotent: the
 * same ratings always give the same rows. Runs in one transaction, so a crash leaves the old stats in place.
 */
export async function rollupRatings(
  db: Database,
  rules: RatingRules = DEFAULT_RATING_RULES,
): Promise<{ titles: number; labelled: number }> {
  return db.transaction(async (tx) => {
    const rows = (await tx.execute(sql`SELECT * FROM title_rating_aggregate()`))
      .rows as unknown as AggregateRow[];
    const counts = rows.map((row) => ({
      key: row.video_id ? `video:${row.video_id}` : `series:${row.series_id}`,
      likes: Number(row.likes),
      loves: Number(row.loves),
      dislikes: Number(row.dislikes),
    }));
    const liked = pickMostLiked(counts, rules);
    for (const [index, row] of rows.entries()) {
      const c = counts[index]!;
      const flag = liked.has(c.key);
      if (row.video_id) {
        await tx.execute(sql`
          INSERT INTO title_rating_stats (video_id, likes, loves, dislikes, most_liked, updated_at)
          VALUES (${row.video_id}::uuid, ${c.likes}, ${c.loves}, ${c.dislikes}, ${flag}, now())
          ON CONFLICT (video_id) WHERE video_id IS NOT NULL DO UPDATE
          SET likes = excluded.likes, loves = excluded.loves, dislikes = excluded.dislikes,
              most_liked = excluded.most_liked, updated_at = now()`);
      } else {
        await tx.execute(sql`
          INSERT INTO title_rating_stats (series_id, likes, loves, dislikes, most_liked, updated_at)
          VALUES (${row.series_id}::uuid, ${c.likes}, ${c.loves}, ${c.dislikes}, ${flag}, now())
          ON CONFLICT (series_id) WHERE series_id IS NOT NULL DO UPDATE
          SET likes = excluded.likes, loves = excluded.loves, dislikes = excluded.dislikes,
              most_liked = excluded.most_liked, updated_at = now()`);
      }
    }
    const keep = counts.map((c) => c.key);
    if (keep.length === 0) {
      await tx.execute(sql`DELETE FROM title_rating_stats`);
    } else {
      await tx.execute(sql`
        DELETE FROM title_rating_stats s WHERE
          CASE WHEN s.video_id IS NOT NULL THEN 'video:' || s.video_id::text
               ELSE 'series:' || s.series_id::text END
          NOT IN (${sql.join(keep.map((k) => sql`${k}`), sql`, `)})`);
    }
    return { titles: counts.length, labelled: liked.size };
  });
}
