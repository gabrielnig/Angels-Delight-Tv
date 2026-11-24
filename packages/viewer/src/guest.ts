import { isUuid, NotFound } from '@ad/shared';
import { findTitle, relatedTitles, type Audience } from '@ad/catalog';
import { annotateCards } from './annotate';
import { catalogContext, type ViewerContext } from './context';
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
  const filter = { kids: audience.kids };
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
