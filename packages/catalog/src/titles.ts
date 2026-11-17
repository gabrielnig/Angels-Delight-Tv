import { sql, type SQL } from 'drizzle-orm';
import { artworkFromRow, type ArtworkDto, type ArtworkRow } from './artwork';
import { clampLimit, decodeCursor, encodeCursor } from './cursor';
import { rowsOf, uuidList } from './sql';
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
  hasCaptions: boolean;
  poster: ArtworkDto | null;
}

export interface CategoryDto {
  id: string;
  slug: string;
  name: string;
  description: string | null;
}

export type BrowseSort = 'newest' | 'az' | 'shortest';
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
  has_captions: boolean;
  sort_at: string | null;
  title_key: string;
  total?: string;
}

const CARD_COLUMNS =
  sql.raw(`t.kind, t.id, t.slug, t.title, t.description, t.duration_ms, t.episode_count,
  t.kids_safe, t.has_captions, t.sort_at::text AS sort_at, t.title_key,
  pa.id AS poster_id, pa.alt_text AS poster_alt, pa.placeholder_color AS poster_color,
  pa.width AS poster_width, pa.height AS poster_height, pa.variants AS poster_variants`);

const POSTER_JOIN = sql.raw(
  `LEFT JOIN assets pa ON pa.id = t.poster_asset_id AND pa.status = 'ready'`,
);

/**
 * Every live title (standalone videos and series) in one relation. Episodes are never titles of their own.
 * The search columns repeat the expressions of the indexes in migration 0007 verbatim.
 */
function titlesCte(audience: Audience, now: Date, withSearch: boolean): SQL {
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
      NULL::int AS episode_count, v.kids_safe, coalesce(v.published_at, v.publish_at) AS sort_at,
      v.poster_asset_id,
      EXISTS (SELECT 1 FROM caption_tracks ct WHERE ct.video_id = v.id AND ct.approved_caption_id IS NOT NULL) AS has_captions,
      ad_unaccent(lower(v.title)) AS title_key,
      ARRAY(SELECT vc.category_id FROM video_categories vc WHERE vc.video_id = v.id) AS category_ids${videoSearch}
    FROM videos v
    WHERE v.kind = 'standalone' AND ${liveVideoSql('v', audience, now)}
    UNION ALL
    SELECT 'series'::text, s.id, s.slug, s.title, s.description, NULL::int,
      (SELECT count(*) FROM seasons esn JOIN episodes eep ON eep.season_id = esn.id JOIN videos ev ON ev.id = eep.video_id
        WHERE esn.series_id = s.id AND ${liveVideoSql('ev', audience, now)})::int,
      s.kids_safe, coalesce(s.published_at, s.publish_at), s.poster_asset_id,
      EXISTS (SELECT 1 FROM seasons csn JOIN episodes cep ON cep.season_id = csn.id
        JOIN caption_tracks ct ON ct.video_id = cep.video_id AND ct.approved_caption_id IS NOT NULL
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
    hasCaptions: row.has_captions,
    poster: artworkFromRow(row, mediaOrigin),
  };
}

/** Cards for the given references, in the given order. Hidden, unpublished and kids unsafe titles are dropped. */
export async function fetchCards(
  tx: Tx,
  ctx: CatalogContext,
  audience: Audience,
  refs: readonly TitleRef[],
): Promise<TitleCard[]> {
  if (refs.length === 0) return [];
  const result = await tx.execute(sql`
    WITH ${titlesCte(audience, ctx.now(), false)}
    SELECT ${CARD_COLUMNS} FROM titles t ${POSTER_JOIN}
    WHERE t.id IN (${uuidList(refs.map((ref) => ref.id))})`);
  const byKey = new Map(
    rowsOf<CardRow>(result).map((row) => [`${row.kind}:${row.id}`, toCard(row, ctx.mediaOrigin)]),
  );
  return refs.flatMap((ref) => byKey.get(`${ref.kind}:${ref.id}`) ?? []);
}

export interface BrowseInput {
  categorySlug?: string;
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

/**
 * Browse a category (or everything). A duration filter or the shortest sort leaves series out, because a series has
 * no single duration (decision D-026).
 */
export async function listTitles(
  tx: Tx,
  ctx: CatalogContext,
  audience: Audience,
  input: BrowseInput,
): Promise<Page<TitleCard>> {
  const limit = clampLimit(input.limit, PAGE_SIZE, MAX_PAGE_SIZE);
  const filters: SQL[] = [];

  if (input.categorySlug !== undefined) {
    const found = rowsOf<{ id: string }>(
      await tx.execute(
        sql`SELECT id FROM categories WHERE slug = ${input.categorySlug} AND is_visible`,
      ),
    )[0];
    if (!found) return { items: [], nextCursor: null };
    filters.push(sql`${found.id}::uuid = ANY(t.category_ids)`);
  }

  const videosOnly = input.duration !== undefined || input.sort === 'shortest';
  if (videosOnly) filters.push(sql`t.kind = 'video'`);
  if (input.duration !== undefined) {
    const [min, max] = DURATION_BUCKETS[input.duration];
    filters.push(sql`t.duration_ms >= ${min}`);
    if (max !== null) filters.push(sql`t.duration_ms < ${max}`);
  }

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

function categoryHasLiveTitle(audience: Audience, now: Date): SQL {
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
    WHERE c.is_visible AND ${categoryHasLiveTitle(audience, ctx.now())}
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

function searchTokens(query: string): string[] {
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
  const tsquery = tokens.map((token) => `${token}:*`).join(' & ');
  const now = ctx.now();

  const result = await tx.execute(sql`
    WITH ${titlesCte(audience, now, true)},
    q AS (SELECT to_tsquery('simple', ad_unaccent(${tsquery})) AS tsq, ad_unaccent(lower(${norm}::text)) AS norm)
    SELECT ${CARD_COLUMNS}, count(*) OVER () AS total
    FROM titles t CROSS JOIN q ${POSTER_JOIN}
    WHERE t.doc @@ q.tsq OR q.norm <% t.title_key OR strpos(t.category_text, q.norm) > 0
    ORDER BY
      round((ts_rank_cd(t.doc, q.tsq) + 0.6 * word_similarity(q.norm, t.title_key)
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
      WHERE c.is_visible AND ${categoryHasLiveTitle(audience, now)}
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
