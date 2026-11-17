import { withAccount } from '@ad/db';
import type { Actor } from '@ad/shared';
import {
  findCategory,
  listCategories,
  listTitles,
  type BrowseSort,
  type CategoryDto,
  type DurationBucket,
  type Page,
} from '@ad/catalog';
import { annotateCards, type TitleCardDto } from './annotate';
import { catalogContext, type ViewerContext } from './context';
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
}

/** Category chips: visible categories holding at least one live title for this profile (M06-S01). */
export async function listBrowseCategories(
  ctx: ViewerContext,
  actor: Actor,
  input: { profileId: string },
): Promise<CategoryDto[]> {
  return withAccount(ctx.db, actor, async (tx) => {
    const profile = await loadOwnedProfile(tx, actor, input.profileId);
    return listCategories(tx, catalogContext(ctx), audienceOf(profile));
  });
}

export async function browse(
  ctx: ViewerContext,
  actor: Actor,
  input: BrowseInput,
): Promise<BrowsePage> {
  return withAccount(ctx.db, actor, async (tx) => {
    const profile = await loadOwnedProfile(tx, actor, input.profileId);
    const audience = audienceOf(profile);
    const category =
      input.categorySlug === undefined ? null : await findCategory(tx, input.categorySlug);
    if (input.categorySlug !== undefined && !category) {
      return { category: null, items: [], nextCursor: null };
    }
    const page = await listTitles(tx, catalogContext(ctx), audience, {
      categorySlug: input.categorySlug,
      sort: input.sort ?? 'newest',
      duration: input.duration,
      limit: input.limit,
      cursor: input.cursor,
    });
    return {
      category,
      items: await annotateCards(tx, profile.id, page.items),
      nextCursor: page.nextCursor,
    };
  });
}
