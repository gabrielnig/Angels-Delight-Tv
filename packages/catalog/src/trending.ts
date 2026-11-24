import { sql } from 'drizzle-orm';
import { rowsOf } from './sql';
import { fetchCards, type TitleCard } from './titles';
import type { Audience, CatalogContext, Tx, TitleRef } from './types';

/** When a row shows at all. A row with thin data is hidden, never faked (M44-S07 AC2, M44-S08, M44-S09). */
export interface TrendingRules {
  /** Titles that must qualify for this audience before Trending shows. */
  minTitles: number;
  /** Plays across the snapshot before Trending shows. */
  minSitePlays: number;
  /** A snapshot older than this is treated as empty. */
  maxAgeHours: number;
  topTenSize: number;
  popularMinViews: number;
  popularMinTitles: number;
}

export const DEFAULT_TRENDING_RULES: TrendingRules = {
  minTitles: 5,
  minSitePlays: 50,
  maxAgeHours: 3,
  topTenSize: 10,
  popularMinViews: 5,
  popularMinTitles: 3,
};

export type TrendingKind = 'trending' | 'top_ten' | 'popular';

interface ScoreRow {
  video_id: string | null;
  series_id: string | null;
  plays: number;
}

/**
 * The cards of a snapshot row for one audience. The snapshot is global and unfiltered, so liveness, kids and the
 * maturity limit are applied here, at read time. `top_ten` is the trending list cut to exactly ten, and its numbers
 * are the positions after filtering.
 */
export async function trendingTitles(
  tx: Tx,
  ctx: CatalogContext,
  audience: Audience,
  options: { kind: TrendingKind; limit: number; rules?: Partial<TrendingRules> },
): Promise<TitleCard[]> {
  const rules = { ...DEFAULT_TRENDING_RULES, ...options.rules };
  const source = options.kind === 'popular' ? 'popular' : 'trending';
  const cutoff = new Date(ctx.now().getTime() - rules.maxAgeHours * 3_600_000);
  const result = await tx.execute(sql`
    SELECT video_id, series_id, plays FROM title_scores
    WHERE kind = ${source} AND computed_at >= ${cutoff}::timestamptz
    ORDER BY rank`);
  const rows = rowsOf<ScoreRow>(result);
  if (rows.length === 0) return [];
  const refs: TitleRef[] = rows.map((row) =>
    row.video_id
      ? { kind: 'video' as const, id: row.video_id }
      : { kind: 'series' as const, id: row.series_id! },
  );
  const cards = await fetchCards(tx, ctx, audience, refs);
  const playsOf = new Map(rows.map((row) => [row.video_id ?? row.series_id!, Number(row.plays)]));
  if (options.kind === 'popular') {
    const qualified = cards.filter((card) => (playsOf.get(card.id) ?? 0) >= rules.popularMinViews);
    return qualified.length >= rules.popularMinTitles ? qualified.slice(0, options.limit) : [];
  }
  const sitePlays = rows.reduce((sum, row) => sum + Number(row.plays), 0);
  if (cards.length < rules.minTitles || sitePlays < rules.minSitePlays) return [];
  if (options.kind === 'top_ten')
    return cards.length >= rules.topTenSize ? cards.slice(0, rules.topTenSize) : [];
  return cards.slice(0, options.limit);
}

/** Titles carrying the computed Most liked label, newest first, filtered for the audience. */
export async function mostLikedTitles(
  tx: Tx,
  ctx: CatalogContext,
  audience: Audience,
  limit: number,
): Promise<TitleCard[]> {
  const result = await tx.execute(sql`
    SELECT video_id, series_id FROM title_rating_stats WHERE most_liked ORDER BY updated_at DESC LIMIT 60`);
  const refs = rowsOf<{ video_id: string | null; series_id: string | null }>(result).map((row) =>
    row.video_id
      ? { kind: 'video' as const, id: row.video_id }
      : { kind: 'series' as const, id: row.series_id! },
  );
  const cards = await fetchCards(tx, ctx, audience, refs);
  return [...cards]
    .sort((a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''))
    .slice(0, limit);
}
