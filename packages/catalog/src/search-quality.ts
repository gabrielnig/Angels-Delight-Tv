import { sql } from 'drizzle-orm';
import type { Database } from '@ad/db';
import { rowsOf } from './sql';
import { normalizeTerm } from './search-synonyms';
import {
  categoryHasLiveTitleSql,
  searchTokens,
  searchTitles,
  type SearchInput,
  type SearchPage,
} from './titles';
import type { Audience, CatalogContext, Tx } from './types';

/** Words of this length or more may be corrected. Shorter words match exactly, fuzzy matches on them are noise. */
export const MIN_CORRECTABLE_LENGTH = 5;
/** Under this many raw results a correction is offered or applied. */
export const FEW_RESULTS = 3;
const MISS_RETENTION_DAYS = 90;
const MISS_MAX_LENGTH = 80;
const SUBJECTS_SHOWN = 5;

/**
 * Rebuilds the word list that "did you mean" corrects against: the words of live title names and category
 * names. It is not filtered by audience on purpose, because a correction is only used when the audience filtered
 * search for it finds something, so a kids profile never sees a suggestion that leads to adult titles.
 */
export async function refreshSearchTerms(db: Database | Tx): Promise<void> {
  await db.execute(sql`DELETE FROM search_terms`);
  await db.execute(sql`
    INSERT INTO search_terms (term)
    SELECT DISTINCT w FROM (
      SELECT regexp_split_to_table(ad_unaccent(lower(v.title)), '[^[:alnum:]]+') AS w
        FROM videos v WHERE v.deleted_at IS NULL AND v.publish_state IN ('published', 'scheduled')
      UNION ALL
      SELECT regexp_split_to_table(ad_unaccent(lower(s.title)), '[^[:alnum:]]+')
        FROM series s WHERE s.deleted_at IS NULL AND s.publish_state IN ('published', 'scheduled')
      UNION ALL
      SELECT regexp_split_to_table(ad_unaccent(lower(c.name::text)), '[^[:alnum:]]+')
        FROM categories c WHERE c.is_visible
    ) words
    WHERE char_length(w) BETWEEN 2 AND 40`);
}

/** A failed refresh must never undo a publish, so it runs in a savepoint and errors are swallowed. */
export async function refreshSearchTermsSafe(tx: Tx): Promise<void> {
  try {
    await tx.transaction((inner) => refreshSearchTerms(inner));
  } catch {
    /* the word list stays as it was */
  }
}

/** The query with each unknown long word replaced by the closest known word, or null when nothing changed. */
export async function correctQuery(tx: Tx, query: string): Promise<string | null> {
  const tokens = searchTokens(query).map(normalizeTerm);
  let changed = false;
  const out: string[] = [];
  for (const token of tokens) {
    if ([...token].length < MIN_CORRECTABLE_LENGTH) {
      out.push(token);
      continue;
    }
    const exact = rowsOf<{ term: string }>(
      await tx.execute(sql`SELECT term FROM search_terms WHERE term = ${token} LIMIT 1`),
    );
    if (exact.length > 0) {
      out.push(token);
      continue;
    }
    const near = rowsOf<{ term: string }>(
      await tx.execute(sql`
        SELECT term FROM search_terms
        WHERE term % ${token} AND char_length(term) >= ${MIN_CORRECTABLE_LENGTH}
        ORDER BY similarity(term, ${token}) DESC, abs(char_length(term) - ${[...token].length}), term
        LIMIT 1`),
    );
    if (near[0]) {
      out.push(near[0].term);
      changed = true;
    } else {
      out.push(token);
    }
  }
  return changed ? out.join(' ') : null;
}

export interface CorrectedSearch {
  page: SearchPage;
  /** Set when the results are for a corrected query ("Showing results for budgeting"). */
  showingFor: string | null;
  /** Set when a few results exist and a corrected query would find more ("Did you mean"). */
  didYouMean: string | null;
}

/**
 * Search with typo help (M45-S07). No raw results: the corrected query's results are returned. One or two
 * raw results: the corrected ones replace them when they find as many, otherwise a did you mean link offers them. A failure in the
 * correction falls back to the plain search.
 */
export async function searchWithCorrection(
  tx: Tx,
  ctx: CatalogContext,
  audience: Audience,
  input: SearchInput & { exact?: boolean },
): Promise<CorrectedSearch> {
  const page = await searchTitles(tx, ctx, audience, input);
  if (input.exact || input.cursor !== undefined || page.total >= FEW_RESULTS) {
    return { page, showingFor: null, didYouMean: null };
  }
  let corrected: string | null = null;
  try {
    corrected = await tx.transaction((inner) => correctQuery(inner, input.query));
  } catch {
    return { page, showingFor: null, didYouMean: null };
  }
  if (!corrected) return { page, showingFor: null, didYouMean: null };
  const better = await searchTitles(tx, ctx, audience, { ...input, query: corrected });
  if (better.total < page.total) return { page, showingFor: null, didYouMean: null };
  // The same number of hits for the corrected spelling means the typo was the cause: show those results.
  if (better.total === page.total || page.total === 0) {
    return { page: better, showingFor: corrected, didYouMean: null };
  }
  return { page, showingFor: null, didYouMean: corrected };
}

export interface Subject {
  slug: string;
  name: string;
}

/** Visible categories with live titles whose name matches the query, an exact name first (M45-S08 AC2). */
export async function searchSubjects(
  tx: Tx,
  ctx: CatalogContext,
  audience: Audience,
  query: string,
): Promise<Subject[]> {
  const norm = searchTokens(query).join(' ').toLowerCase();
  if (norm.length < 2) return [];
  const rows = rowsOf<Subject>(
    await tx.execute(sql`
      SELECT c.slug, c.name::text AS name FROM categories c
      WHERE c.is_visible AND ${categoryHasLiveTitleSql(audience, ctx.now())}
        AND (strpos(ad_unaccent(lower(c.name::text)), ad_unaccent(${norm}::text)) > 0
          OR ad_unaccent(${norm}::text) = ANY (string_to_array(ad_unaccent(lower(c.name::text)), ' ')))
      ORDER BY (ad_unaccent(lower(c.name::text)) = ad_unaccent(${norm}::text)) DESC, c.position, c.name
      LIMIT ${SUBJECTS_SHOWN}`),
  );
  return rows;
}

/** Replaces every synonym group in one transaction (the admin editor saves the whole list). */
export async function replaceSynonymGroups(db: Database, groups: string[][]): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.execute(sql`DELETE FROM search_synonyms`);
    for (const terms of groups) {
      await tx.execute(
        sql`INSERT INTO search_synonyms (terms, created_at) VALUES (ARRAY[${sql.join(
          terms.map((t) => sql`${t}`),
          sql`, `,
        )}]::text[], clock_timestamp())`,
      );
    }
  });
}

export async function listSynonymGroups(db: Database | Tx): Promise<string[][]> {
  return rowsOf<{ terms: string[] }>(
    await db.execute(sql`SELECT terms FROM search_synonyms ORDER BY created_at, id`),
  ).map((r) => r.terms);
}

function missKey(query: string): string {
  return normalizeTerm(query).slice(0, MISS_MAX_LENGTH).trim();
}

/**
 * Counts a search that found nothing. Only the normalised words are stored: no account, profile, session or
 * address (M45-S09). Logging problems never reach the caller.
 */
export async function recordMiss(db: Database | Tx, query: string, now: Date): Promise<void> {
  const key = missKey(query);
  if (key === '') return;
  try {
    await db.execute(sql`
      INSERT INTO search_misses (query_norm, hits, last_seen) VALUES (${key}, 1, ${now.toISOString()}::timestamptz)
      ON CONFLICT (query_norm) DO UPDATE SET hits = search_misses.hits + 1, last_seen = EXCLUDED.last_seen`);
  } catch {
    /* a lost count is better than a failed search */
  }
}

export async function pruneMisses(db: Database | Tx, now: Date): Promise<number> {
  const cutoff = new Date(now.getTime() - MISS_RETENTION_DAYS * 86_400_000);
  const result = await db.execute(
    sql`DELETE FROM search_misses WHERE last_seen < ${cutoff.toISOString()}::timestamptz`,
  );
  return (result as { rowCount?: number }).rowCount ?? 0;
}

export interface MissRow {
  query: string;
  hits: number;
  lastSeen: Date;
}

export async function listMisses(db: Database | Tx, limit = 50): Promise<MissRow[]> {
  return rowsOf<{ query_norm: string; hits: number; last_seen: Date | string }>(
    await db.execute(
      sql`SELECT query_norm, hits, last_seen FROM search_misses ORDER BY hits DESC, last_seen DESC LIMIT ${limit}`,
    ),
  ).map((r) => ({ query: r.query_norm, hits: Number(r.hits), lastSeen: new Date(r.last_seen) }));
}
