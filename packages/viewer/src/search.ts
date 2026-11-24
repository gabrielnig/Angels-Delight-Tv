import { and, desc, eq, sql } from 'drizzle-orm';
import { searchHistory, withAccount } from '@ad/db';
import { ValidationFailed, type Actor } from '@ad/shared';
import {
  MAX_QUERY_LENGTH,
  MIN_QUERY_LENGTH,
  popularTitles,
  recordMiss,
  searchSubjects,
  searchWithCorrection,
  suggestTitles,
  type Audience,
  type Page,
  type Subject,
  type Suggestion,
} from '@ad/catalog';
import type { Tx } from '@ad/catalog';
import { annotateCards, type TitleCardDto } from './annotate';
import { catalogContext, clockOf, spendAttempt, type ViewerContext } from './context';
import { audienceOf, loadOwnedProfile } from './profiles';

export const RECENT_SEARCHES_SHOWN = 8;
const RECENT_SEARCHES_KEPT = 20;
const NO_RESULTS_POPULAR = 12;

export interface SearchInput {
  profileId: string;
  query: string;
  limit?: number;
  cursor?: string;
  /** Set when the viewer submitted the search (Enter), not while typing. Kids profiles never record. */
  record?: boolean;
  /** Search the words exactly as typed, with no spelling correction. */
  exact?: boolean;
}

export interface SearchResultDto extends Page<TitleCardDto> {
  query: string;
  total: number;
  /** Filled on the first page of a search with no results, for the no results state (M06-S05). */
  popular: TitleCardDto[];
  /** Categories whose name matches the query, for the Subjects row (M45-S08). */
  subjects: Subject[];
  /** Set when the results are for a corrected spelling: Showing results for this (M45-S07). */
  showingFor: string | null;
  /** A better spelling to offer as a link when a few results exist. */
  didYouMean: string | null;
}

/** The shape both paths share: corrected search, subjects and the miss count. */
async function qualitySearch(
  tx: Tx,
  ctx: ViewerContext,
  audience: Audience,
  input: { query: string; limit?: number; cursor?: string; exact?: boolean; recordMiss: boolean },
) {
  const catalog = catalogContext(ctx);
  const found = await searchWithCorrection(tx, catalog, audience, {
    query: input.query,
    limit: input.limit,
    cursor: input.cursor,
    exact: input.exact,
  });
  const first = input.cursor === undefined;
  const subjects = first ? await searchSubjects(tx, catalog, audience, input.query) : [];
  if (input.recordMiss && first && found.page.total === 0) {
    // Only the normalised words are kept, and a failure must not undo the search, so it runs in a savepoint.
    try {
      await tx.transaction((inner) => recordMiss(inner, input.query, clockOf(ctx)));
    } catch {
      /* a lost count is fine */
    }
  }
  return { ...found, subjects };
}

function normalizeQuery(raw: string): string {
  const query = raw.trim().replace(/\s+/g, ' ');
  if ([...query].length < MIN_QUERY_LENGTH) {
    throw new ValidationFailed({ query: [`Type at least ${MIN_QUERY_LENGTH} characters`] });
  }
  return query.slice(0, MAX_QUERY_LENGTH);
}

export async function search(
  ctx: ViewerContext,
  actor: Actor,
  input: SearchInput,
): Promise<SearchResultDto> {
  const query = normalizeQuery(input.query);
  return withAccount(ctx.db, actor, async (tx) => {
    const profile = await loadOwnedProfile(tx, actor, input.profileId);
    await spendAttempt(ctx, 'search', actor.accountId);
    const audience = audienceOf(profile);
    const catalog = catalogContext(ctx);
    const found = await qualitySearch(tx, ctx, audience, {
      query,
      limit: input.limit,
      cursor: input.cursor,
      exact: input.exact,
      recordMiss: input.record === true && !profile.isKids,
    });
    const page = found.page;

    if (input.record && !profile.isKids) {
      await tx
        .insert(searchHistory)
        .values({
          profileId: profile.id,
          query: query.toLocaleLowerCase(),
          searchedAt: clockOf(ctx),
        })
        .onConflictDoUpdate({
          target: [searchHistory.profileId, searchHistory.query],
          set: { searchedAt: clockOf(ctx) },
        });
      await tx.execute(sql`
        DELETE FROM search_history WHERE profile_id = ${profile.id}::uuid AND query NOT IN (
          SELECT query FROM search_history WHERE profile_id = ${profile.id}::uuid
          ORDER BY searched_at DESC LIMIT ${RECENT_SEARCHES_KEPT})`);
    }

    const popular =
      page.total === 0 && input.cursor === undefined
        ? await popularTitles(tx, catalog, audience, {
            limit: NO_RESULTS_POPULAR,
            fallbackToNewest: true,
          })
        : [];
    return {
      query,
      total: page.total,
      items: await annotateCards(tx, profile.id, page.items),
      nextCursor: page.nextCursor,
      popular: await annotateCards(tx, profile.id, popular),
      subjects: found.subjects,
      showingFor: found.showingFor,
      didYouMean: found.didYouMean,
    };
  });
}

/**
 * Search for a guest (M40). No `search_history` row is written, whatever the caller asks. A search that found
 * nothing and was submitted adds to the anonymous misses count (M45-S09). The rate limit
 * is spent by the public guard on the address and the guest id, not here.
 */
export async function searchFor(
  ctx: ViewerContext,
  audience: Audience,
  input: Omit<SearchInput, 'profileId'>,
): Promise<SearchResultDto> {
  const query = normalizeQuery(input.query);
  const catalog = catalogContext(ctx);
  return ctx.db.transaction(async (tx) => {
    const found = await qualitySearch(tx, ctx, audience, {
      query,
      limit: input.limit,
      cursor: input.cursor,
      exact: input.exact,
      recordMiss: input.record === true && !audience.kids,
    });
    const page = found.page;
    const popular =
      page.total === 0 && input.cursor === undefined
        ? await popularTitles(tx, catalog, audience, {
            limit: NO_RESULTS_POPULAR,
            fallbackToNewest: true,
          })
        : [];
    return {
      query,
      total: page.total,
      items: await annotateCards(tx, null, page.items),
      nextCursor: page.nextCursor,
      popular: await annotateCards(tx, null, popular),
      subjects: found.subjects,
      showingFor: found.showingFor,
      didYouMean: found.didYouMean,
    };
  });
}

export async function suggest(
  ctx: ViewerContext,
  actor: Actor,
  input: { profileId: string; query: string },
): Promise<Suggestion[]> {
  return withAccount(ctx.db, actor, async (tx) => {
    const profile = await loadOwnedProfile(tx, actor, input.profileId);
    await spendAttempt(ctx, 'search', actor.accountId);
    return suggestTitles(tx, catalogContext(ctx), audienceOf(profile), input.query);
  });
}

export async function getRecentSearches(
  ctx: ViewerContext,
  actor: Actor,
  input: { profileId: string },
): Promise<string[]> {
  return withAccount(ctx.db, actor, async (tx) => {
    const profile = await loadOwnedProfile(tx, actor, input.profileId);
    if (profile.isKids) return [];
    const rows = await tx
      .select({ query: searchHistory.query })
      .from(searchHistory)
      .where(eq(searchHistory.profileId, profile.id))
      .orderBy(desc(searchHistory.searchedAt))
      .limit(RECENT_SEARCHES_SHOWN);
    return rows.map((row) => row.query);
  });
}

export async function removeRecentSearch(
  ctx: ViewerContext,
  actor: Actor,
  input: { profileId: string; query: string },
): Promise<void> {
  await withAccount(ctx.db, actor, async (tx) => {
    const profile = await loadOwnedProfile(tx, actor, input.profileId);
    await tx
      .delete(searchHistory)
      .where(
        and(
          eq(searchHistory.profileId, profile.id),
          eq(searchHistory.query, input.query.trim().toLocaleLowerCase()),
        ),
      );
  });
}

export async function clearRecentSearches(
  ctx: ViewerContext,
  actor: Actor,
  input: { profileId: string },
): Promise<void> {
  await withAccount(ctx.db, actor, async (tx) => {
    const profile = await loadOwnedProfile(tx, actor, input.profileId);
    await tx.delete(searchHistory).where(eq(searchHistory.profileId, profile.id));
  });
}
