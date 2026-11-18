import { sql } from 'drizzle-orm';
import type { RowKind } from '@ad/shared';
import { rowsOf } from './sql';
import { fetchCards, listTitles, popularTitles, type TitleCard } from './titles';
import type { Audience, CatalogContext, Tx } from './types';

export interface RowDescriptor {
  id: string;
  title: string;
  kind: RowKind;
  categorySlug: string | null;
  /** Set on a curated row that follows one series. */
  seriesId: string | null;
  maxItems: number;
}

export type SeeAll = { type: 'category'; slug: string } | { type: 'browse' } | { type: 'my_list' };

export interface ResolvedRow {
  cards: TitleCard[];
  seeAll: SeeAll | null;
}

const HERO_MAX_ITEMS = 5;

/** Published rows in curated order. A kids audience only gets rows the editor marked kids visible. */
export async function listPublishedRows(tx: Tx, audience: Audience): Promise<RowDescriptor[]> {
  const result = await tx.execute(sql`
    SELECT r.id, r.title, r.kind, c.slug AS category_slug, r.series_id, r.max_items
    FROM rows r LEFT JOIN categories c ON c.id = r.category_id AND c.is_visible
    WHERE r.is_published ${audience.kids ? sql`AND r.kids_visible` : sql``}
    ORDER BY r.position`);
  return rowsOf<{
    id: string;
    title: string;
    kind: RowKind;
    category_slug: string | null;
    series_id: string | null;
    max_items: number;
  }>(result).map((row) => ({
    id: row.id,
    title: row.title,
    kind: row.kind,
    categorySlug: row.category_slug,
    seriesId: row.series_id,
    maxItems: row.max_items,
  }));
}

/** Row kinds that exist at all, published or not. A personal row is added by default only when the editor has none. */
export async function configuredRowKinds(tx: Tx): Promise<Set<RowKind>> {
  const result = await tx.execute(sql`SELECT DISTINCT kind FROM rows`);
  return new Set(rowsOf<{ kind: RowKind }>(result).map((row) => row.kind));
}

/** The episodes of a series in season and episode order. Unpublished or deleted ones are filtered when the cards load. */
async function seriesRefs(tx: Tx, seriesId: string, limit: number) {
  const result = await tx.execute(sql`
    SELECT e.video_id FROM episodes e
    JOIN seasons sn ON sn.id = e.season_id
    JOIN videos v ON v.id = e.video_id AND v.deleted_at IS NULL
    WHERE sn.series_id = ${seriesId}::uuid
    ORDER BY sn.number, e.number LIMIT ${limit}`);
  return rowsOf<{ video_id: string }>(result).map((item) => ({
    kind: 'video' as const,
    id: item.video_id,
  }));
}

async function curatedRefs(tx: Tx, rowId: string, limit: number) {
  const result = await tx.execute(sql`
    SELECT video_id, series_id FROM row_items WHERE row_id = ${rowId}::uuid ORDER BY position LIMIT ${limit}`);
  return rowsOf<{ video_id: string | null; series_id: string | null }>(result).map((item) =>
    item.video_id
      ? { kind: 'video' as const, id: item.video_id }
      : { kind: 'series' as const, id: item.series_id! },
  );
}

/** The cards of one catalog row (curated, category, recently added or popular), already filtered for the audience. */
export async function resolveRow(
  tx: Tx,
  ctx: CatalogContext,
  audience: Audience,
  row: RowDescriptor,
): Promise<ResolvedRow> {
  switch (row.kind) {
    case 'curated': {
      if (row.seriesId) {
        // Episodes are not standalone titles, so their cards come from the episode aware query.
        const refs = await seriesRefs(tx, row.seriesId, row.maxItems);
        return { cards: await fetchCards(tx, ctx, audience, refs, { includeEpisodes: true }), seeAll: null };
      }
      const refs = await curatedRefs(tx, row.id, row.maxItems);
      return { cards: await fetchCards(tx, ctx, audience, refs), seeAll: null };
    }
    case 'category': {
      if (row.categorySlug === null) return { cards: [], seeAll: null };
      const page = await listTitles(tx, ctx, audience, {
        categorySlug: row.categorySlug,
        sort: 'newest',
        limit: row.maxItems,
      });
      return {
        cards: page.items,
        seeAll: page.nextCursor ? { type: 'category', slug: row.categorySlug } : null,
      };
    }
    case 'recently_added': {
      const page = await listTitles(tx, ctx, audience, { sort: 'newest', limit: row.maxItems });
      return { cards: page.items, seeAll: page.nextCursor ? { type: 'browse' } : null };
    }
    case 'popular':
      return {
        cards: await popularTitles(tx, ctx, audience, { limit: row.maxItems }),
        seeAll: null,
      };
    default:
      return { cards: [], seeAll: null };
  }
}

/**
 * Hero banner titles: the first published hero row that has live items (up to five). Without one, the newest live
 * title for this audience (M05-S01), which for a kids audience is always kids safe.
 */
export async function heroCards(
  tx: Tx,
  ctx: CatalogContext,
  audience: Audience,
  rows: readonly RowDescriptor[],
): Promise<TitleCard[]> {
  for (const row of rows.filter((candidate) => candidate.kind === 'hero')) {
    const refs = await curatedRefs(tx, row.id, HERO_MAX_ITEMS);
    const cards = await fetchCards(tx, ctx, audience, refs);
    if (cards.length > 0) return cards;
  }
  const newest = await listTitles(tx, ctx, audience, { sort: 'newest', limit: 1 });
  return newest.items;
}
