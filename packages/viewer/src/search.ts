import { and, desc, eq, sql } from 'drizzle-orm';
import { searchHistory, withAccount } from '@ad/db';
import { RateLimited, ValidationFailed, type Actor } from '@ad/shared';
import {
  MAX_QUERY_LENGTH,
  MIN_QUERY_LENGTH,
  popularTitles,
  searchTitles,
  suggestTitles,
  type Page,
  type Suggestion,
} from '@ad/catalog';
import { annotateCards, type TitleCardDto } from './annotate';
import { catalogContext, clockOf, type ViewerContext } from './context';
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
}

export interface SearchResultDto extends Page<TitleCardDto> {
  query: string;
  total: number;
  /** Filled on the first page of a search with no results, for the no results state (M06-S05). */
  popular: TitleCardDto[];
}

function normalizeQuery(raw: string): string {
  const query = raw.trim().replace(/\s+/g, ' ');
  if ([...query].length < MIN_QUERY_LENGTH) {
    throw new ValidationFailed({ query: [`Type at least ${MIN_QUERY_LENGTH} characters`] });
  }
  return query.slice(0, MAX_QUERY_LENGTH);
}

async function takeSearchSlot(ctx: ViewerContext, accountId: string): Promise<void> {
  if (ctx.rateLimit && !(await ctx.rateLimit(`search:${accountId}`))) throw new RateLimited(60);
}

export async function search(
  ctx: ViewerContext,
  actor: Actor,
  input: SearchInput,
): Promise<SearchResultDto> {
  const query = normalizeQuery(input.query);
  return withAccount(ctx.db, actor, async (tx) => {
    const profile = await loadOwnedProfile(tx, actor, input.profileId);
    await takeSearchSlot(ctx, actor.accountId);
    const audience = audienceOf(profile);
    const catalog = catalogContext(ctx);
    const page = await searchTitles(tx, catalog, audience, {
      query,
      limit: input.limit,
      cursor: input.cursor,
    });

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
    await takeSearchSlot(ctx, actor.accountId);
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
