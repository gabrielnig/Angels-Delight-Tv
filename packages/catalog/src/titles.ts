import { viewerTrackSql } from './caption-visibility';
import { sql, type SQL } from 'drizzle-orm';
import { artworkFromRow, type ArtworkDto, type ArtworkRow } from './artwork';
import { clampLimit, decodeCursor, encodeCursor } from './cursor';
import { rowsOf, uuidList } from './sql';
import { loadSynonymGroups, buildTsQueries } from './search-synonyms';
import type { Audience, CatalogContext, Page, Tx, TitleKind, TitleRef } from './types';
import { liveSeriesSql, liveVideoSql } from './visibility';

/** A card as the UI draws it: enough for a grid tile or a row item, never a table row. */
export interface TitleCard {
  kind: TitleKind;
  id: string;
  slug: string;
  title: string;
  description: string | null;
  /** Null for a series. */
  durationMs: number | null;
  /** Null for a video. Counts live episodes only. */
  episodeCount: number | null;
  kidsSafe: boolean;
  /** 0 (G) to 4 (18), null until rated. A card never leaves the database above the audience limit (M44). */
  maturityRank: number | null;
  hasCaptions: boolean;
  poster: ArtworkDto | null;
  /** The first visible category by position, or null when the title has none (M06). */
  categorySlug: string | null;
  categoryName: string | null;
  /** When the title went live (ISO), or is due to. Null only for data that was never published. */
  publishedAt: string | null;
}

export interface CategoryDto {
  id: string;
  slug: string;
  name: string;
  description: string | null;
}

export type BrowseSort = 'newest' | 'az' | 'shortest' | 'longest';
export type DurationBucket = 'short' | 'medium' | 'long';

/** Duration buckets in milliseconds, as [min inclusive, max exclusive). The story calls the first one "under 3 minutes". */
export const DURATION_BUCKETS: Record<DurationBucket, [number, number | null]> = {
  short: [0, 180_000],
  medium: [180_000, 300_000],
  long: [300_000, null],
};

export const PAGE_SIZE = 24;
export const MAX_PAGE_SIZE = 50;
export const MAX_QUERY_LENGTH = 80;
export const MIN_QUERY_LENGTH = 2;

interface CardRow extends ArtworkRow {
  kind: TitleKind;
  id: string;
  slug: string;
  title: string;
  description: string | null;
  duration_ms: number | null;
  episode_count: number | null;
  kids_safe: boolean;
  maturity_rank: number | null;
  has_captions: boolean;
  sort_at: string | null;
  category_slug: string | null;
  category_name: string | null;
  title_key: string;
  total?: string;
}

const CARD_COLUMNS =
  sql.raw(`t.kind, t.id, t.slug, t.title, t.description, t.duration_ms, t.episode_count,
  t.kids_safe, t.maturity_rank, t.has_captions, t.sort_at::text AS sort_at, t.title_key,
  (SELECT c.slug FROM categories c WHERE c.id = ANY(t.category_ids) AND c.is_visible ORDER BY c.position, c.name LIMIT 1) AS category_slug,
  (SELECT c.name::text FROM categories c WHERE c.id = ANY(t.category_ids) AND c.is_visible ORDER BY c.position, c.name LIMIT 1) AS category_name,
  pa.id AS poster_id, pa.alt_text AS poster_alt, pa.placeholder_color AS poster_color, pa.placeholder_blur AS poster_blur,
  pa.width AS poster_width, pa.height AS poster_height, pa.variants AS poster_variants`);

const POSTER_JOIN = sql.raw(
  `LEFT JOIN assets pa ON pa.id = t.poster_asset_id AND pa.status = 'ready'`,
);

/**
 * Every live title (standalone videos and series) in one relation. Episodes are never titles of their own.
 * The search columns repeat the expressions of the indexes in migration 0007 verbatim.
 */
function titlesCte(
  audience: Audience,
  now: Date,
  withSearch: boolean,
  includeEpisodes = false,
): SQL {
  const videoSearch = withSearch
    ? sql`, setweight(to_tsvector('simple', ad_unaccent(v.title)), 'A') || setweight(to_tsvector('simple', ad_unaccent(coalesce(v.description, ''))), 'B') AS doc,
      coalesce((SELECT string_agg(ad_unaccent(lower(c.name)), ' ') FROM video_categories vc JOIN categories c ON c.id = vc.category_id WHERE vc.video_id = v.id AND c.is_visible), '') AS category_text`
    : sql``;
  const seriesSearch = withSearch
    ? sql`, setweight(to_tsvector('simple', ad_unaccent(s.title)), 'A') || setweight(to_tsvector('simple', ad_unaccent(coalesce(s.description, ''))), 'B') AS doc,
      coalesce((SELECT string_agg(ad_unaccent(lower(c.name)), ' ') FROM series_categories sc JOIN categories c ON c.id = sc.category_id WHERE sc.series_id = s.id AND c.is_visible), '') AS category_text`
    : sql``;
  return sql`titles AS (
    SELECT 'video'::text AS kind, v.id, v.slug, v.title, v.description, v.duration_ms::int AS duration_ms,
      NULL::int AS episode_count, v.kids_safe, v.maturity_rank, coalesce(v.published_at, v.publish_at) AS sort_at,
      v.poster_asset_id,
      (EXISTS (SELECT 1 FROM caption_tracks ct WHERE ct.video_id = v.id AND ${sql.raw(viewerTrackSql('ct'))})
      AND coalesce(v.captions_enabled, NOT EXISTS (SELECT 1 FROM settings st WHERE st.key = 'features.captions_default_available' AND st.value = 'false'::jsonb))) AS has_captions,
      ad_unaccent(lower(v.title)) AS title_key,
      ARRAY(SELECT vc.category_id FROM video_categories vc WHERE vc.video_id = v.id) AS category_ids${videoSearch}
    FROM videos v
    WHERE v.kind IN (${sql.raw(includeEpisodes ? "'standalone', 'episode'" : "'standalone'")}) AND ${liveVideoSql('v', audience, now)}
    UNION ALL
    SELECT 'series'::text, s.id, s.slug, s.title, s.description, NULL::int,
      (SELECT count(*) FROM seasons esn JOIN episodes eep ON eep.season_id = esn.id JOIN videos ev ON ev.id = eep.video_id
        WHERE esn.series_id = s.id AND ${liveVideoSql('ev', audience, now)})::int,
      s.kids_safe, s.maturity_rank, coalesce(s.published_at, s.publish_at), s.poster_asset_id,
      EXISTS (SELECT 1 FROM seasons csn JOIN episodes cep ON cep.season_id = csn.id
        JOIN caption_tracks ct ON ct.video_id = cep.video_id AND ${sql.raw(viewerTrackSql('ct'))}
        WHERE csn.series_id = s.id),
      ad_unaccent(lower(s.title)),
      ARRAY(SELECT sc.category_id FROM series_categories sc WHERE sc.series_id = s.id)${seriesSearch}
    FROM series s
    WHERE ${liveSeriesSql('s', audience, now)}
  )`;
}

function toCard(row: CardRow, mediaOrigin: string): TitleCard {
  return {
    kind: row.kind,
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    durationMs: row.duration_ms,
    episodeCount: row.episode_count,
    kidsSafe: row.kids_safe,
    maturityRank: row.maturity_rank ?? null,
    hasCaptions: row.has_captions,
    poster: artworkFromRow(row, mediaOrigin),
    categorySlug: row.category_slug,
    categoryName: row.category_name,
    publishedAt: row.sort_at === null ? null : new Date(row.sort_at).toISOString(),
  };
}

/** Cards for the given references, in the given order. Hidden, unpublished and kids unsafe titles are dropped. */
export async function fetchCards(
  tx: Tx,
  ctx: CatalogContext,
  audience: Audience,
  refs: readonly TitleRef[],
  options: { includeEpisodes?: boolean } = {},
): Promise<TitleCard[]> {
  if (refs.length === 0) return [];
  const result = await tx.execute(sql`
    WITH ${titlesCte(audience, ctx.now(), false, options.includeEpisodes)}
    SELECT ${CARD_COLUMNS} FROM titles t ${POSTER_JOIN}
    WHERE t.id IN (${uuidList(refs.map((ref) => ref.id))})`);
  const byKey = new Map(
    rowsOf<CardRow>(result).map((row) => [`${row.kind}:${row.id}`, toCard(row, ctx.mediaOrigin)]),
  );
  return refs.flatMap((ref) => byKey.get(`${ref.kind}:${ref.id}`) ?? []);
}

export interface BrowseInput {
  categorySlug?: string;
  /** Only series, or only standalone videos. */
  kind?: TitleKind;
  sort: BrowseSort;
  duration?: DurationBucket;
  limit?: number;
  cursor?: string;
}

interface KeysetCursor {
  k: string;
  i: string;
}

function isKeysetCursor(value: unknown): value is KeysetCursor {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as KeysetCursor).k === 'string' &&
    typeof (value as KeysetCursor).i === 'string' &&
    /^[0-9a-f-]{36}$/.test((value as KeysetCursor).i)
  );
}

/** The category, duration and kind filters of a browse, shared by the page query and the count. Null when the category is unknown or hidden. */
async function browseFilters(
  tx: Tx,
  input: Pick<BrowseInput, 'categorySlug' | 'duration' | 'sort' | 'kind'>,
): Promise<SQL[] | null> {
  const filters: SQL[] = [];
  if (input.kind !== undefined) filters.push(sql`t.kind = ${input.kind}`);
  if (input.categorySlug !== undefined) {
    const found = rowsOf<{ id: string }>(
      await tx.execute(
        sql`SELECT id FROM categories WHERE slug = ${input.categorySlug} AND is_visible`,
      ),
    )[0];
    if (!found) return null;
    filters.push(sql`${found.id}::uuid = ANY(t.category_ids)`);
  }
  const videosOnly =
    input.duration !== undefined || input.sort === 'shortest' || input.sort === 'longest';
  if (videosOnly) filters.push(sql`t.kind = 'video'`);
  if (input.duration !== undefined) {
    const [min, max] = DURATION_BUCKETS[input.duration];
    filters.push(sql`t.duration_ms >= ${min}`);
    if (max !== null) filters.push(sql`t.duration_ms < ${max}`);
  }
  return filters;
}

/** How many titles a browse holds, for the "N videos" line. Ignores paging. */
export async function countTitles(
  tx: Tx,
  ctx: CatalogContext,
  audience: Audience,
  input: Pick<BrowseInput, 'categorySlug' | 'duration' | 'sort' | 'kind'>,
): Promise<number> {
  const filters = await browseFilters(tx, input);
  if (filters === null) return 0;
  const where = filters.length > 0 ? sql`WHERE ${sql.join(filters, sql` AND `)}` : sql``;
  const result = await tx.execute(sql`
    WITH ${titlesCte(audience, ctx.now(), false)}
    SELECT count(*)::int AS total FROM titles t ${where}`);
  return rowsOf<{ total: number }>(result)[0]?.total ?? 0;
}

/**
 * Browse a category (or everything). A duration filter or the shortest sort leaves series out, because a series has
 * no single duration (decision D-050).
 */
export async function listTitles(
  tx: Tx,
  ctx: CatalogContext,
  audience: Audience,
  input: BrowseInput,
): Promise<Page<TitleCard>> {
  const limit = clampLimit(input.limit, PAGE_SIZE, MAX_PAGE_SIZE);
  const base = await browseFilters(tx, input);
  if (base === null) return { items: [], nextCursor: null };
  const filters: SQL[] = [...base];

  let orderBy: SQL;
  let keyColumn: SQL;
  let after: SQL | null = null;
  const cursor = input.cursor === undefined ? null : decodeCursor(input.cursor, isKeysetCursor);
  if (input.sort === 'newest') {
    orderBy = sql`t.sort_at DESC, t.id DESC`;
    keyColumn = sql`t.sort_at::text`;
    if (cursor) after = sql`(t.sort_at, t.id) < (${cursor.k}::timestamptz, ${cursor.i}::uuid)`;
  } else if (input.sort === 'az') {
    orderBy = sql`t.title_key ASC, t.id ASC`;
    keyColumn = sql`t.title_key`;
    if (cursor) after = sql`(t.title_key, t.id) > (${cursor.k}, ${cursor.i}::uuid)`;
  } else if (input.sort === 'longest') {
    orderBy = sql`t.duration_ms DESC, t.id DESC`;
    keyColumn = sql`t.duration_ms::text`;
    if (cursor) after = sql`(t.duration_ms, t.id) < (${cursor.k}::int, ${cursor.i}::uuid)`;
  } else {
    orderBy = sql`t.duration_ms ASC, t.id ASC`;
    keyColumn = sql`t.duration_ms::text`;
    if (cursor) after = sql`(t.duration_ms, t.id) > (${cursor.k}::int, ${cursor.i}::uuid)`;
  }
  if (after) filters.push(after);

  const where = filters.length > 0 ? sql`WHERE ${sql.join(filters, sql` AND `)}` : sql``;
  const result = await tx.execute(sql`
    WITH ${titlesCte(audience, ctx.now(), false)}
    SELECT ${CARD_COLUMNS}, ${keyColumn} AS cursor_key
    FROM titles t ${POSTER_JOIN}
    ${where}
    ORDER BY ${orderBy}
    LIMIT ${limit + 1}`);
  const rows = rowsOf<CardRow & { cursor_key: string }>(result);
  const pageRows = rows.slice(0, limit);
  const last = pageRows[pageRows.length - 1];
  return {
    items: pageRows.map((row) => toCard(row, ctx.mediaOrigin)),
    nextCursor:
      rows.length > limit && last ? encodeCursor({ k: last.cursor_key, i: last.id }) : null,
  };
}

export function categoryHasLiveTitleSql(audience: Audience, now: Date): SQL {
  return sql`(EXISTS (SELECT 1 FROM video_categories cvc JOIN videos cv ON cv.id = cvc.video_id
      WHERE cvc.category_id = c.id AND cv.kind = 'standalone' AND ${liveVideoSql('cv', audience, now)})
    OR EXISTS (SELECT 1 FROM series_categories csc JOIN series cs ON cs.id = csc.series_id
      WHERE csc.category_id = c.id AND ${liveSeriesSql('cs', audience, now)}))`;
}

/** Visible categories that hold at least one live title for this audience, in curated order (M04-S04, M06-S01). */
export async function listCategories(
  tx: Tx,
  ctx: CatalogContext,
  audience: Audience,
): Promise<CategoryDto[]> {
  const result = await tx.execute(sql`
    SELECT c.id, c.slug, c.name::text AS name, c.description
    FROM categories c
    WHERE c.is_visible AND ${categoryHasLiveTitleSql(audience, ctx.now())}
    ORDER BY c.position, c.name`);
  return rowsOf<CategoryDto>(result);
}

export interface SearchInput {
  query: string;
  limit?: number;
  cursor?: string;
}

export interface SearchPage extends Page<TitleCard> {
  total: number;
}

export function searchTokens(query: string): string[] {
  return [...query.matchAll(/[\p{L}\p{N}]+/gu)].map((match) => match[0]).slice(0, 8);
}

function isOffsetCursor(value: unknown): value is { o: number } {
  return (
    typeof value === 'object' &&
    value !== null &&
    Number.isInteger((value as { o: number }).o) &&
    (value as { o: number }).o >= 0 &&
    (value as { o: number }).o <= 10_000
  );
}

/**
 * Full text search with accent folding, prefix matching for as-you-type use and trigram tolerance for typos.
 * The query only ever reaches Postgres as a bound parameter built from letters and digits. Results are ranked
 * by title match, then description match, then recent views. Ranking is not stable under a keyset, so the cursor
 * carries an offset (the result set is small and capped).
 */
export async function searchTitles(
  tx: Tx,
  ctx: CatalogContext,
  audience: Audience,
  input: SearchInput,
): Promise<SearchPage> {
  const limit = clampLimit(input.limit, PAGE_SIZE, MAX_PAGE_SIZE);
  const tokens = searchTokens(input.query.slice(0, MAX_QUERY_LENGTH));
  const norm = tokens.join(' ');
  if (norm.length < MIN_QUERY_LENGTH) return { items: [], nextCursor: null, total: 0 };
  const offset = input.cursor === undefined ? 0 : decodeCursor(input.cursor, isOffsetCursor).o;
  const { expanded, exact } = buildTsQueries(tokens, await loadSynonymGroups(tx));
  const now = ctx.now();
  // Words of four characters or fewer match exactly: fuzzy matching on them is noise (M45-S07 AC2).
  const fuzzy = tokens.every((token) => [...token].length >= 5);

  const result = await tx.execute(sql`
    WITH ${titlesCte(audience, now, true)},
    q AS (SELECT to_tsquery('simple', ad_unaccent(${expanded})) AS tsq,
      to_tsquery('simple', ad_unaccent(${exact})) AS exact_tsq,
      ad_unaccent(lower(${norm}::text)) AS norm)
    SELECT ${CARD_COLUMNS}, count(*) OVER () AS total
    FROM titles t CROSS JOIN q ${POSTER_JOIN}
    WHERE t.doc @@ q.tsq OR (${fuzzy}::boolean AND q.norm <% t.title_key) OR strpos(t.category_text, q.norm) > 0
    ORDER BY
      round((ts_rank_cd(t.doc, q.exact_tsq) + 0.1 * ts_rank_cd(t.doc, q.tsq) + 0.6 * word_similarity(q.norm, t.title_key)
        + CASE WHEN strpos(t.category_text, q.norm) > 0 THEN 0.3 ELSE 0 END)::numeric, 4) DESC,
      CASE WHEN t.kind = 'video' THEN coalesce((SELECT sum(d.views) FROM video_daily_stats d
        WHERE d.video_id = t.id AND d.day >= (${now}::timestamptz)::date - 30), 0) ELSE 0 END DESC,
      t.id
    LIMIT ${limit} OFFSET ${offset}`);
  const rows = rowsOf<CardRow>(result);
  const total = rows[0] ? Number(rows[0].total) : 0;
  const nextOffset = offset + limit;
  return {
    items: rows.map((row) => toCard(row, ctx.mediaOrigin)),
    nextCursor: nextOffset < total ? encodeCursor({ o: nextOffset }) : null,
    total,
  };
}

export interface Suggestion {
  kind: 'title' | 'category';
  label: string;
  slug: string;
  titleKind?: TitleKind;
}

const MAX_SUGGESTIONS = 5;

/** Up to five title and category suggestions for a typed prefix, filtered like every other read. */
export async function suggestTitles(
  tx: Tx,
  ctx: CatalogContext,
  audience: Audience,
  query: string,
): Promise<Suggestion[]> {
  const norm = searchTokens(query.slice(0, MAX_QUERY_LENGTH)).join(' ').toLowerCase();
  if (norm.length < MIN_QUERY_LENGTH) return [];
  const now = ctx.now();
  const normSql = sql`ad_unaccent(lower(${norm}::text))`;

  const titleRows = rowsOf<{ kind: TitleKind; title: string; slug: string }>(
    await tx.execute(sql`
      WITH ${titlesCte(audience, now, false)}
      SELECT t.kind, t.title, t.slug FROM titles t
      WHERE starts_with(t.title_key, ${normSql}) OR strpos(t.title_key, ' ' || ${normSql}) > 0
      ORDER BY starts_with(t.title_key, ${normSql}) DESC, t.title_key
      LIMIT ${MAX_SUGGESTIONS}`),
  );
  const categoryRows = rowsOf<{ name: string; slug: string }>(
    await tx.execute(sql`
      SELECT c.name::text AS name, c.slug FROM categories c
      WHERE c.is_visible AND ${categoryHasLiveTitleSql(audience, now)}
        AND (starts_with(ad_unaccent(lower(c.name)), ${normSql}) OR strpos(ad_unaccent(lower(c.name)), ' ' || ${normSql}) > 0)
      ORDER BY c.position, c.name
      LIMIT ${MAX_SUGGESTIONS}`),
  );

  const categoryRoom = Math.min(categoryRows.length, 2);
  const titles = titleRows.slice(0, MAX_SUGGESTIONS - categoryRoom);
  const categories = categoryRows.slice(0, MAX_SUGGESTIONS - titles.length);
  return [
    ...titles.map((row) => ({
      kind: 'title' as const,
      label: row.title,
      slug: row.slug,
      titleKind: row.kind,
    })),
    ...categories.map((row) => ({ kind: 'category' as const, label: row.name, slug: row.slug })),
  ];
}

export const RELATED_LIMIT = 12;

/** Titles that share a visible category with `ref`, most shared categories first, never `ref` itself. */
export async function relatedTitles(
  tx: Tx,
  ctx: CatalogContext,
  audience: Audience,
  ref: TitleRef,
  limit = RELATED_LIMIT,
): Promise<TitleCard[]> {
  const joinTable = ref.kind === 'video' ? sql`video_categories` : sql`series_categories`;
  const idColumn = ref.kind === 'video' ? sql`video_id` : sql`series_id`;
  const categoryIds = rowsOf<{ category_id: string }>(
    await tx.execute(sql`
      SELECT j.category_id FROM ${joinTable} j JOIN categories c ON c.id = j.category_id
      WHERE j.${idColumn} = ${ref.id}::uuid AND c.is_visible`),
  ).map((row) => row.category_id);
  if (categoryIds.length === 0) return [];

  const shared = sql`ARRAY[${uuidList(categoryIds)}]::uuid[]`;
  const result = await tx.execute(sql`
    WITH ${titlesCte(audience, ctx.now(), false)}
    SELECT ${CARD_COLUMNS} FROM titles t ${POSTER_JOIN}
    WHERE t.category_ids && ${shared} AND t.id <> ${ref.id}::uuid
    ORDER BY (SELECT count(*) FROM unnest(t.category_ids) x WHERE x = ANY(${shared})) DESC, t.sort_at DESC, t.id DESC
    LIMIT ${Math.min(Math.max(limit, 1), MAX_PAGE_SIZE)}`);
  return rowsOf<CardRow>(result).map((row) => toCard(row, ctx.mediaOrigin));
}

export const POPULAR_WINDOW_DAYS = 30;

/**
 * Videos ordered by views over the last 30 days (from the nightly rollup in video_daily_stats). With
 * `fallbackToNewest` a catalog without any stats still returns something, for the no results page (M06-S05).
 */
export async function popularTitles(
  tx: Tx,
  ctx: CatalogContext,
  audience: Audience,
  options: { limit: number; fallbackToNewest?: boolean; windowDays?: number },
): Promise<TitleCard[]> {
  const now = ctx.now();
  const windowDays = options.windowDays ?? POPULAR_WINDOW_DAYS;
  const limit = Math.min(Math.max(options.limit, 1), MAX_PAGE_SIZE);
  const result = await tx.execute(sql`
    WITH ${titlesCte(audience, now, false)}
    SELECT ${CARD_COLUMNS}, coalesce(pv.views, 0) AS recent_views
    FROM titles t ${POSTER_JOIN}
    LEFT JOIN LATERAL (
      SELECT sum(d.views) AS views FROM video_daily_stats d
      WHERE d.video_id = t.id AND d.day >= (${now}::timestamptz)::date - ${windowDays}::int
    ) pv ON true
    WHERE t.kind = 'video'
    ORDER BY coalesce(pv.views, 0) DESC, t.sort_at DESC, t.id DESC
    LIMIT ${limit}`);
  const rows = rowsOf<CardRow & { recent_views: string }>(result);
  const popular = rows.filter((row) => Number(row.recent_views) > 0);
  const chosen = popular.length > 0 || !options.fallbackToNewest ? popular : rows;
  return chosen.map((row) => toCard(row, ctx.mediaOrigin));
}

export interface CategoryCount extends CategoryDto {
  /** Live titles in the category for this audience. */
  count: number;
}

/** Visible categories with how many live titles each holds, in curated order (M41-S05 AC3). */
export async function categoryTitleCounts(
  tx: Tx,
  ctx: CatalogContext,
  audience: Audience,
): Promise<CategoryCount[]> {
  const result = await tx.execute(sql`
    WITH ${titlesCte(audience, ctx.now(), false)}
    SELECT c.id, c.slug, c.name::text AS name, c.description,
      (SELECT count(*)::int FROM titles t WHERE c.id = ANY(t.category_ids)) AS count
    FROM categories c
    WHERE c.is_visible
    ORDER BY c.position, c.name`);
  return rowsOf<CategoryCount>(result).filter((category) => category.count > 0);
}

/** True when at least one title is live for this audience. Drives the "new videos are on the way" state. */
export async function hasLiveTitle(
  tx: Tx,
  ctx: CatalogContext,
  audience: Audience,
): Promise<boolean> {
  const now = ctx.now();
  const result = await tx.execute(sql`
    SELECT (EXISTS (SELECT 1 FROM videos v WHERE v.kind = 'standalone' AND ${liveVideoSql('v', audience, now)})
      OR EXISTS (SELECT 1 FROM series s WHERE ${liveSeriesSql('s', audience, now)})) AS found`);
  return rowsOf<{ found: boolean }>(result)[0]?.found === true;
}

/** Looks a title up by slug. A video wins over a series with the same slug unless `kind` says otherwise. */
export async function findTitleRefBySlug(
  tx: Tx,
  ctx: CatalogContext,
  audience: Audience,
  slug: string,
  kind?: TitleKind,
): Promise<TitleRef | null> {
  const result = await tx.execute(sql`
    WITH ${titlesCte(audience, ctx.now(), false)}
    SELECT t.kind, t.id FROM titles t
    WHERE t.slug = ${slug} ${kind ? sql`AND t.kind = ${kind}` : sql``}
    ORDER BY (t.kind = 'video') DESC LIMIT 1`);
  return rowsOf<TitleRef>(result)[0] ?? null;
}

/** A category by slug when the editor has it switched on, whether or not it holds titles right now. */
export async function findCategory(tx: Tx, slug: string): Promise<CategoryDto | null> {
  const result = await tx.execute(sql`
    SELECT id, slug, name::text AS name, description FROM categories WHERE slug = ${slug} AND is_visible`);
  return rowsOf<CategoryDto>(result)[0] ?? null;
}
