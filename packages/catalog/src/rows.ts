import { sql } from 'drizzle-orm';
import { resolveViewAll, type RowKind, type ViewAllMode, type ViewAllTarget } from '@ad/shared';
import { fetchHeroArtwork } from './detail';
import { mediaUrl } from './artwork';
import { rowsOf } from './sql';
import { categoryTitleCounts, fetchCards, listTitles, popularTitles, type TitleCard } from './titles';
import { mostLikedTitles, trendingTitles, type TrendingRules } from './trending';
import type { Audience, CatalogContext, Tx } from './types';

export interface RowDescriptor {
  id: string;
  title: string;
  kind: RowKind;
  categorySlug: string | null;
  /** Set on a curated row that follows one series. */
  seriesId: string | null;
  seriesSlug: string | null;
  /** Address of a manual row's list page (/browse/row/{slug}). */
  slug: string | null;
  viewAllMode: ViewAllMode;
  viewAllUrl: string | null;
  /** Fewer live titles than this hides the row. */
  minItems: number;
  maxItems: number;
  /** Popular rows only: show the newest titles when too few qualify (M44-S08). */
  fallbackToNewest: boolean;
  /** The row title while it shows the fallback. Blank means "Newly added". */
  fallbackTitle: string | null;
}

export const DEFAULT_FALLBACK_TITLE = 'Newly added';

export interface ResolvedRow {
  cards: TitleCard[];
  /** Set when the row shows under another title than its own, the Popular fallback. */
  title?: string;
  /** Where View all goes, or null for none (M41-S08). */
  viewAll: ViewAllTarget | null;
}

/** Server rules the home rows need. Defaults live in ViewerRules. */
export interface RowRules {
  trendingWindowDays: number;
  autoCategoryMax: number;
  /** Popular counts views over this many days, needs `popularMinViews` per title and `popularMinTitles` titles (M44-S08). */
  popularWindowDays: number;
  popularMinViews: number;
  popularMinTitles: number;
  /** Overrides for the trending snapshot rules. */
  trending?: Partial<TrendingRules>;
}

const DEFAULT_ROW_RULES: RowRules = {
  trendingWindowDays: 7,
  autoCategoryMax: 6,
  popularWindowDays: 30,
  popularMinViews: 5,
  popularMinTitles: 3,
};

const HERO_MAX_ITEMS = 5;

/** Published rows in curated order. A kids audience only gets rows the editor marked kids visible. */
export async function listPublishedRows(tx: Tx, audience: Audience): Promise<RowDescriptor[]> {
  const result = await tx.execute(sql`
    SELECT r.id, r.title, r.kind, c.slug AS category_slug, r.series_id, sr.slug AS series_slug, r.slug,
      r.view_all_mode, r.view_all_url, r.min_items, r.max_items, r.fallback_to_newest, r.fallback_title
    FROM rows r
    LEFT JOIN categories c ON c.id = r.category_id AND c.is_visible
    LEFT JOIN series sr ON sr.id = r.series_id
    WHERE r.is_published ${audience.kids ? sql`AND r.kids_visible` : sql``}
    ORDER BY r.position`);
  return rowsOf<{
    id: string;
    title: string;
    kind: RowKind;
    category_slug: string | null;
    series_id: string | null;
    series_slug: string | null;
    slug: string | null;
    view_all_mode: ViewAllMode;
    view_all_url: string | null;
    min_items: number;
    max_items: number;
    fallback_to_newest: boolean;
    fallback_title: string | null;
  }>(result).map((row) => ({
    id: row.id,
    title: row.title,
    kind: row.kind,
    categorySlug: row.category_slug,
    seriesId: row.series_id,
    seriesSlug: row.series_slug,
    slug: row.slug,
    viewAllMode: row.view_all_mode,
    viewAllUrl: row.view_all_url,
    minItems: row.min_items,
    maxItems: row.max_items,
    fallbackToNewest: row.fallback_to_newest,
    fallbackTitle: row.fallback_title,
  }));
}

/**
 * Turns Browse by subject rows into one category row for each visible category that has enough live titles, in
 * category order, skipping categories that already have their own row and stopping at the cap (M41-S05 AC3).
 */
export async function expandRows(
  tx: Tx,
  ctx: CatalogContext,
  audience: Audience,
  descriptors: readonly RowDescriptor[],
  rules: Pick<RowRules, 'autoCategoryMax'> = DEFAULT_ROW_RULES,
): Promise<RowDescriptor[]> {
  if (!descriptors.some((row) => row.kind === 'each_category')) return [...descriptors];
  const taken = new Set(
    descriptors.flatMap((row) => (row.kind === 'category' && row.categorySlug ? [row.categorySlug] : [])),
  );
  const counts = await categoryTitleCounts(tx, ctx, audience);
  let made = 0;
  const out: RowDescriptor[] = [];
  for (const row of descriptors) {
    if (row.kind !== 'each_category') {
      out.push(row);
      continue;
    }
    for (const category of counts) {
      if (made >= rules.autoCategoryMax) break;
      if (taken.has(category.slug) || category.count < row.minItems) continue;
      taken.add(category.slug);
      made += 1;
      out.push({
        ...row,
        id: `${row.id}:${category.slug}`,
        title: category.name,
        kind: 'category',
        categorySlug: category.slug,
        slug: null,
        viewAllMode: 'auto',
        viewAllUrl: null,
        minItems: 1,
      });
    }
  }
  return out;
}

/** One published manual row by its list page slug, or null when it is unknown, unpublished or hidden from a kids audience. */
export async function resolveRowBySlug(
  tx: Tx,
  audience: Audience,
  slug: string,
): Promise<RowDescriptor | null> {
  const rowsNow = await listPublishedRows(tx, audience);
  return rowsNow.find((row) => row.slug === slug && row.kind === 'curated') ?? null;
}

/** The whole list behind a curated row's View all link, in editor order (M41-S08). Null when the slug is not open to this audience. */
export async function listRowPage(
  tx: Tx,
  ctx: CatalogContext,
  audience: Audience,
  slug: string,
  limit = 100,
): Promise<{ title: string; slug: string; cards: TitleCard[] } | null> {
  const row = await resolveRowBySlug(tx, audience, slug);
  if (!row) return null;
  const cards = await resolveCards(tx, ctx, audience, { ...row, maxItems: limit }, DEFAULT_ROW_RULES);
  return { title: row.title, slug, cards };
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

/** The cards of one catalog row (curated, category, recently added, popular or all series), already filtered for the audience. */
export async function resolveRow(
  tx: Tx,
  ctx: CatalogContext,
  audience: Audience,
  row: RowDescriptor,
  rules: RowRules = DEFAULT_ROW_RULES,
): Promise<ResolvedRow> {
  let title: string | undefined;
  let cards: TitleCard[];
  if (row.kind === 'popular') {
    const popular = await popularCards(tx, ctx, audience, row, rules);
    cards = popular.cards;
    if (popular.fellBack) title = row.fallbackTitle?.trim() || DEFAULT_FALLBACK_TITLE;
  } else cards = await resolveCards(tx, ctx, audience, row, rules);
  // Under its minimum a row is hidden, and Trending never borrows titles from New (M41-S05 AC2).
  const shown = cards.length >= Math.max(1, row.minItems) ? cards : [];
  const viewAll = resolveViewAll({
    kind: row.kind,
    mode: row.viewAllMode,
    url: row.viewAllUrl,
    categorySlug: row.categorySlug,
    seriesSlug: row.seriesSlug,
    rowSlug: row.slug,
  });
  return {
    cards: shown,
    ...(shown.length > 0 && title ? { title } : {}),
    viewAll: shown.length > 0 ? viewAll : null,
  };
}

/**
 * Popular (M44-S08): titles with enough views over 30 days, series included. With fewer than three, the row is
 * hidden, or with Fall back to newest it shows the newest titles under its fallback title.
 */
async function popularCards(
  tx: Tx,
  ctx: CatalogContext,
  audience: Audience,
  row: RowDescriptor,
  rules: RowRules,
): Promise<{ cards: TitleCard[]; fellBack: boolean }> {
  const qualified = await popularTitles(tx, ctx, audience, {
    limit: row.maxItems,
    windowDays: rules.popularWindowDays,
    minViews: rules.popularMinViews,
  });
  if (qualified.length >= rules.popularMinTitles) return { cards: qualified, fellBack: false };
  if (!row.fallbackToNewest) return { cards: [], fellBack: false };
  const newest = await listTitles(tx, ctx, audience, { sort: 'newest', limit: row.maxItems });
  return { cards: newest.items, fellBack: true };
}

async function resolveCards(
  tx: Tx,
  ctx: CatalogContext,
  audience: Audience,
  row: RowDescriptor,
  rules: RowRules,
): Promise<TitleCard[]> {
  switch (row.kind) {
    case 'curated': {
      if (row.seriesId) {
        // Episodes are not standalone titles, so their cards come from the episode aware query.
        const refs = await seriesRefs(tx, row.seriesId, row.maxItems);
        return fetchCards(tx, ctx, audience, refs, { includeEpisodes: true });
      }
      return fetchCards(tx, ctx, audience, await curatedRefs(tx, row.id, row.maxItems));
    }
    case 'category': {
      if (row.categorySlug === null) return [];
      const page = await listTitles(tx, ctx, audience, {
        categorySlug: row.categorySlug,
        sort: 'newest',
        limit: row.maxItems,
      });
      return page.items;
    }
    case 'recently_added':
      return (await listTitles(tx, ctx, audience, { sort: 'newest', limit: row.maxItems })).items;
    case 'all_series':
      return (
        await listTitles(tx, ctx, audience, { sort: 'newest', kind: 'series', limit: row.maxItems })
      ).items;
    case 'popular':
      return (await popularCards(tx, ctx, audience, row, rules)).cards;
    case 'trending':
      return trendingTitles(tx, ctx, audience, { kind: 'trending', limit: row.maxItems, rules: rules.trending });
    case 'top_ten':
      return trendingTitles(tx, ctx, audience, { kind: 'top_ten', limit: rules.trending?.topTenSize ?? 10, rules: rules.trending });
    case 'most_liked':
      return mostLikedTitles(tx, ctx, audience, row.maxItems);
    default:
      return [];
  }
}

export const HERO_FALLBACK_COUNT = 5;

/**
 * Hero banner titles: the first published hero row that has live items (up to five, the editor's intent). Without
 * one, or when every chosen title is hidden, the newest live titles for this audience, those with artwork first
 * (M41-S03). For a kids audience this is always kids safe.
 */
export async function heroCards(
  tx: Tx,
  ctx: CatalogContext,
  audience: Audience,
  rows: readonly RowDescriptor[],
  fallbackCount: number = HERO_FALLBACK_COUNT,
): Promise<TitleCard[]> {
  for (const row of rows.filter((candidate) => candidate.kind === 'hero')) {
    const refs = await curatedRefs(tx, row.id, HERO_MAX_ITEMS);
    const cards = await fetchCards(tx, ctx, audience, refs);
    if (cards.length > 0) return cards;
  }
  const count = Math.min(Math.max(1, Math.trunc(fallbackCount)), HERO_MAX_ITEMS);
  const newest = await listTitles(tx, ctx, audience, { sort: 'newest', limit: count * 4 });
  const art = await fetchHeroArtwork(
    tx,
    ctx,
    newest.items.map((card) => ({ kind: card.kind, id: card.id })),
  );
  const hasArt = (card: TitleCard) => card.poster !== null || art.has(card.id);
  return [...newest.items.filter(hasArt), ...newest.items.filter((card) => !hasArt(card))].slice(
    0,
    count,
  );
}

/** The preview clip is cut to this length (see the video package). */
/** Length assumed for a clip made before the length was recorded (they were all 6 seconds). */
export const HERO_PREVIEW_MS = 6000;

export interface HeroSlideExtras {
  /** The editor's own words for this slide. Null falls back to the title's text. */
  headline: string | null;
  blurb: string | null;
  buttonLabel: string | null;
  /** The muted clip, only when it is ready and the editor has not turned it off. A series uses its first episode. */
  previewUrl: string | null;
  previewMs: number | null;
  /** The clip carries an audio track. False for clips made before sound existed. */
  previewHasAudio: boolean;
}

/** Editor text and the optional preview clip for the hero cards, by card id (M41-S10, S11). */
export async function heroSlideExtras(
  tx: Tx,
  ctx: CatalogContext,
  rows: readonly RowDescriptor[],
  cards: readonly { kind: 'video' | 'series'; id: string }[],
): Promise<Map<string, HeroSlideExtras>> {
  const out = new Map<string, HeroSlideExtras>();
  if (cards.length === 0) return out;
  const videoIds = cards.filter((c) => c.kind === 'video').map((c) => c.id);
  const seriesIds = cards.filter((c) => c.kind === 'series').map((c) => c.id);
  const heroRowIds = rows.filter((r) => r.kind === 'hero').map((r) => r.id);
  const uuids = (ids: string[]) => sql`ARRAY[${sql.join(ids.map((id) => sql`${id}::uuid`), sql`, `)}]::uuid[]`;

  const text = new Map<string, { h: string | null; b: string | null; l: string | null }>();
  if (heroRowIds.length) {
    const result = await tx.execute(sql`
      SELECT video_id, series_id, hero_headline, hero_blurb, hero_button_label FROM row_items
      WHERE row_id = ANY(${uuids(heroRowIds)})
        AND (${videoIds.length ? sql`video_id = ANY(${uuids(videoIds)})` : sql`false`}
          OR ${seriesIds.length ? sql`series_id = ANY(${uuids(seriesIds)})` : sql`false`})
      ORDER BY position`);
    for (const r of rowsOf<{
      video_id: string | null;
      series_id: string | null;
      hero_headline: string | null;
      hero_blurb: string | null;
      hero_button_label: string | null;
    }>(result)) {
      const id = (r.video_id ?? r.series_id)!;
      if (!text.has(id)) text.set(id, { h: r.hero_headline, b: r.hero_blurb, l: r.hero_button_label });
    }
  }

  const clips = new Map<string, { key: string; ms: number; audio: boolean }>();
  const clipVideos = async (ids: string[]) =>
    ids.length
      ? rowsOf<{ id: string; preview_key: string; preview_length_ms: number | null; preview_has_audio: boolean }>(
          await tx.execute(sql`
            SELECT id, preview_key, preview_length_ms, preview_has_audio FROM videos
            WHERE id = ANY(${uuids(ids)}) AND preview_state = 'ready' AND preview_mode <> 'off'
              AND preview_key IS NOT NULL`),
        )
      : [];
  const clipOf = (v: { preview_key: string; preview_length_ms: number | null; preview_has_audio: boolean }) => ({
    key: v.preview_key,
    ms: v.preview_length_ms ?? HERO_PREVIEW_MS,
    audio: v.preview_has_audio === true,
  });
  for (const v of await clipVideos(videoIds)) clips.set(v.id, clipOf(v));
  if (seriesIds.length) {
    const firsts = rowsOf<{ series_id: string; video_id: string }>(
      await tx.execute(sql`
        SELECT DISTINCT ON (s.series_id) s.series_id, e.video_id
        FROM episodes e JOIN seasons s ON s.id = e.season_id
        WHERE s.series_id = ANY(${uuids(seriesIds)})
        ORDER BY s.series_id, s.number, e.number`),
    );
    const found = new Map((await clipVideos(firsts.map((f) => f.video_id))).map((v) => [v.id, clipOf(v)]));
    for (const f of firsts) {
      const clip = found.get(f.video_id);
      if (clip) clips.set(f.series_id, clip);
    }
  }

  for (const card of cards) {
    const t = text.get(card.id);
    const clip = clips.get(card.id);
    out.set(card.id, {
      headline: t?.h ?? null,
      blurb: t?.b ?? null,
      buttonLabel: t?.l ?? null,
      previewUrl: clip ? mediaUrl(ctx.mediaOrigin, clip.key) : null,
      previewMs: clip ? clip.ms : null,
      previewHasAudio: clip ? clip.audio : false,
    });
  }
  return out;
}
