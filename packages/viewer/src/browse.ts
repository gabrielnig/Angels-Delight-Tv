import { withAccount } from '@ad/db';
import type { Actor } from '@ad/shared';
import {
  countTitles,
  findCategory,
  listCategories,
  listRowPage,
  listTitles,
  popularTitles,
  type Audience,
  type BrowseSort,
  type CategoryDto,
  type DurationBucket,
  type Page,
  type TitleCard,
} from '@ad/catalog';
import { annotateCards, type TitleCardDto } from './annotate';
import { audienceKey, catalogContext, rulesOf, shared, type ViewerContext } from './context';
import { audienceOf, loadOwnedProfile } from './profiles';

export interface BrowseInput {
  profileId: string;
  categorySlug?: string;
  sort?: BrowseSort;
  duration?: DurationBucket;
  limit?: number;
  cursor?: string;
}

export interface BrowsePage extends Page<TitleCardDto> {
  /** The category being browsed, or null for all titles or a category that is switched off. */
  category: CategoryDto | null;
  /** How many titles the whole browse holds under these filters, for the "N videos" line. */
  total: number;
}

/** Category chips: visible categories holding at least one live title for this profile (M06-S01). */
type ViewerTx = Parameters<Parameters<ViewerContext['db']['transaction']>[0]>[0];

export async function listBrowseCategories(
  ctx: ViewerContext,
  actor: Actor,
  input: { profileId: string },
): Promise<CategoryDto[]> {
  return withAccount(ctx.db, actor, async (tx) => {
    const profile = await loadOwnedProfile(tx, actor, input.profileId);
    return categoriesFor(tx, ctx, audienceOf(profile));
  });
}

/** Shared by the account and guest paths: the chips depend on the audience only. */
export function categoriesFor(
  tx: ViewerTx,
  ctx: ViewerContext,
  audience: Audience,
): Promise<CategoryDto[]> {
  return shared(ctx, ['categories', audienceKey(audience)], () =>
    listCategories(tx, catalogContext(ctx), audience),
  );
}

export async function browse(
  ctx: ViewerContext,
  actor: Actor,
  input: BrowseInput,
): Promise<BrowsePage> {
  return withAccount(ctx.db, actor, async (tx) => {
    const profile = await loadOwnedProfile(tx, actor, input.profileId);
    return browseFor(tx, ctx, audienceOf(profile), profile.id, input);
  });
}

/** Shared by the account and guest paths. A null profile id means no personal annotation (M40). */
export async function browseFor(
  tx: ViewerTx,
  ctx: ViewerContext,
  audience: Audience,
  profileId: string | null,
  input: Omit<BrowseInput, 'profileId'>,
): Promise<BrowsePage> {
  {
    // The titles on a page, and how many there are, are the same for everyone in this audience.
    // Progress and My List are added per profile below, outside the cache.
    const shown = await shared(
      ctx,
      [
        'browse',
        audienceKey(audience),
        input.categorySlug,
        input.sort,
        input.duration,
        input.limit,
        input.cursor,
      ],
      async () => {
        const category =
          input.categorySlug === undefined ? null : await findCategory(tx, input.categorySlug);
        if (input.categorySlug !== undefined && !category) return null;
        const page = await listTitles(tx, catalogContext(ctx), audience, {
          categorySlug: input.categorySlug,
          sort: input.sort ?? 'newest',
          duration: input.duration,
          limit: input.limit,
          cursor: input.cursor,
        });
        const total = await countTitles(tx, catalogContext(ctx), audience, {
          categorySlug: input.categorySlug,
          sort: input.sort ?? 'newest',
          duration: input.duration,
        });
        return { category, page, total };
      },
    );
    if (!shown) return { category: null, items: [], nextCursor: null, total: 0 };
    const { category, page, total } = shown;
    return {
      category,
      items: await annotateCards(tx, profileId, page.items),
      nextCursor: page.nextCursor,
      total,
    };
  }
}

export type ListKind = 'new' | 'trending' | 'series' | 'row';

export interface ListInput {
  list: ListKind;
  /** The curated row slug, for the `row` list. */
  slug?: string;
  duration?: DurationBucket;
  cursor?: string;
  limit?: number;
}

export interface ListPageDto extends Page<TitleCardDto> {
  title: string;
  total: number;
}

const TRENDING_PAGE = 50;

/**
 * The list pages View all links open (M41-S08): New (paged), Trending (top 50 for the window), Series and one
 * curated section in editor order. Null means the page does not exist for this audience, so the route is a 404.
 */
export async function browseListFor(
  tx: ViewerTx,
  ctx: ViewerContext,
  audience: Audience,
  profileId: string | null,
  input: ListInput,
): Promise<ListPageDto | null> {
  const catalog = catalogContext(ctx);
  const done = async (title: string, cards: readonly TitleCard[], next: string | null, total: number) => ({
    title,
    items: await annotateCards(tx, profileId, cards),
    nextCursor: next,
    total,
  });
  switch (input.list) {
    case 'new': {
      const page = await browseFor(tx, ctx, audience, profileId, {
        sort: 'newest',
        duration: input.duration,
        limit: input.limit,
        cursor: input.cursor,
      });
      return { ...page, title: 'New this week' };
    }
    case 'trending': {
      const cards = await popularTitles(tx, catalog, audience, {
        limit: TRENDING_PAGE,
        windowDays: rulesOf(ctx).trendingWindowDays,
      });
      return done('Trending', cards, null, cards.length);
    }
    case 'series': {
      const page = await listTitles(tx, catalog, audience, {
        sort: 'newest',
        kind: 'series',
        limit: input.limit,
        cursor: input.cursor,
      });
      return done('Series', page.items, page.nextCursor, page.items.length);
    }
    case 'row': {
      if (!input.slug) return null;
      const row = await listRowPage(tx, catalog, audience, input.slug);
      if (!row) return null;
      return done(row.title, row.cards, null, row.cards.length);
    }
  }
}

export async function browseList(
  ctx: ViewerContext,
  actor: Actor,
  input: ListInput & { profileId: string },
): Promise<ListPageDto | null> {
  return withAccount(ctx.db, actor, async (tx) => {
    const profile = await loadOwnedProfile(tx, actor, input.profileId);
    return browseListFor(tx, ctx, audienceOf(profile), profile.id, input);
  });
}
