import { isUuid, NotFound, ValidationFailed } from '@ad/shared';
import {
  fetchCards,
  findTitle,
  popularTitles,
  relatedTitles,
  suggestTitles,
  type Audience,
  type CategoryDto,
  type Suggestion,
} from '@ad/catalog';
import { annotateCards, type TitleCardDto } from './annotate';
import { browseFor, categoriesFor, type BrowseInput, type BrowsePage } from './browse';
import { catalogContext, type ViewerContext } from './context';
import { searchFor, type SearchInput, type SearchResultDto } from './search';
import { seriesPlayTarget, videoPlayTarget } from './play-target';
import { buildSeasons, type TitleDetailDto, type TitleDetailInput } from './title-detail';

/**
 * The account free catalog path for guests (M40, D-G10). Every function takes an audience and no actor, and runs
 * in a plain transaction: no `withAccount`, no profile, no personal table. The row level security tables
 * (`my_list`, `watch_progress`, `search_history` and the rest) are never touched, so a mistake here fails closed.
 * The audience is the only thing a guest has. Kids mode is the same query filter a kids profile gets.
 */
export interface GuestAudience extends Audience {
  kids: boolean;
}

/** `{ profileId }` is not part of the guest input, a value a caller passes is never read. */
export type GuestTitleInput = Omit<TitleDetailInput, 'profileId'>;

/** The title or series page for a guest. Hidden and Kids mode unsafe titles are not found. */
export async function guestTitleDetail(
  ctx: ViewerContext,
  audience: GuestAudience,
  input: GuestTitleInput,
): Promise<TitleDetailDto> {
  const catalog = catalogContext(ctx);
  const filter = { kids: audience.kids, maxRank: audience.maxRank };
  if (input.id !== undefined && !isUuid(input.id)) throw new NotFound('Title not found');
  return ctx.db.transaction(async (tx) => {
    const found = await findTitle(tx, catalog, filter, input);
    if (!found) throw new NotFound('Title not found');
    if (found.type === 'redirect') return found;

    const { title } = found;
    const [card] = await annotateCards(tx, null, [title.card]);
    const related = await annotateCards(
      tx,
      null,
      await relatedTitles(tx, catalog, filter, { kind: title.card.kind, id: title.card.id }),
    );
    const base = {
      card: card!,
      hero: title.hero,
      categories: title.categories,
      captionTracks: title.captionTracks,
      publishedAt: title.publishedAt,
      related,
    };
    if (title.card.kind === 'video') {
      return {
        type: 'video' as const,
        ...base,
        language: title.language,
        progress: null,
        play: videoPlayTarget(ctx, title.card, null),
      };
    }
    const play = await seriesPlayTarget(tx, ctx, filter, null, title.card.id);
    return {
      type: 'series' as const,
      ...base,
      seasons: await buildSeasons(tx, ctx, filter, null, title.card.id, play),
      play,
    };
  });
}

/** Most ids one batch lookup takes (the guest Continue learning row, M40-S14). */
export const GUEST_BATCH_MAX = 20;

export { getGuestHome as guestHome } from './home';

export function guestBrowse(
  ctx: ViewerContext,
  audience: GuestAudience,
  input: Omit<BrowseInput, 'profileId'>,
): Promise<BrowsePage> {
  return ctx.db.transaction((tx) => browseFor(tx, ctx, { kids: audience.kids, maxRank: audience.maxRank }, null, input));
}

export function guestCategories(
  ctx: ViewerContext,
  audience: GuestAudience,
): Promise<CategoryDto[]> {
  return ctx.db.transaction((tx) => categoriesFor(tx, ctx, { kids: audience.kids, maxRank: audience.maxRank }));
}

/** Writes nothing, whatever the caller passes: there is no `record` option on this path. */
export function guestSearch(
  ctx: ViewerContext,
  audience: GuestAudience,
  input: Omit<SearchInput, 'profileId' | 'record'>,
): Promise<SearchResultDto> {
  return searchFor(ctx, { kids: audience.kids, maxRank: audience.maxRank }, input);
}

export function guestSuggest(
  ctx: ViewerContext,
  audience: GuestAudience,
  query: string,
): Promise<Suggestion[]> {
  return ctx.db.transaction((tx) =>
    suggestTitles(tx, catalogContext(ctx), { kids: audience.kids, maxRank: audience.maxRank }, query),
  );
}

export async function guestPopular(
  ctx: ViewerContext,
  audience: GuestAudience,
  options: { limit: number },
): Promise<TitleCardDto[]> {
  return ctx.db.transaction(async (tx) =>
    annotateCards(
      tx,
      null,
      await popularTitles(
        tx,
        catalogContext(ctx),
        { kids: audience.kids, maxRank: audience.maxRank },
        {
          limit: options.limit,
          fallbackToNewest: true,
        },
      ),
    ),
  );
}

/**
 * Cards for ids a device remembers (guest Continue learning). Anything that is not a UUID, not published, hidden
 * or not allowed in this audience is dropped without a trace. More than 20 ids is refused.
 */
export async function guestTitlesByIds(
  ctx: ViewerContext,
  audience: GuestAudience,
  ids: readonly string[],
): Promise<TitleCardDto[]> {
  if (ids.length > GUEST_BATCH_MAX)
    throw new ValidationFailed({ ids: [`Send at most ${GUEST_BATCH_MAX} ids`] });
  const unique = [...new Set(ids.filter((id) => isUuid(id)))];
  if (unique.length === 0) return [];
  return ctx.db.transaction(async (tx) => {
    // The same id can be a video here. A series is never a device progress entry.
    const cards = await fetchCards(
      tx,
      catalogContext(ctx),
      { kids: audience.kids, maxRank: audience.maxRank },
      unique.map((id) => ({ kind: 'video' as const, id })),
      { includeEpisodes: true },
    );
    const byId = new Map(cards.map((card) => [card.id, card]));
    const ordered = ids.flatMap((id) => {
      const card = byId.get(id);
      return card ? [card] : [];
    });
    return annotateCards(tx, null, ordered);
  });
}
