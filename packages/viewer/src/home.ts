import { withAccount } from '@ad/db';
import { resolveViewAll, type Actor, type RowKind, type ViewAllTarget } from '@ad/shared';
import {
  configuredRowKinds,
  expandRows,
  decodeCursor,
  encodeCursor,
  fetchHeroArtwork,
  hasLiveTitle,
  heroCards,
  listPublishedRows,
  resolveRow,
  type ArtworkDto,
  type Audience,
  type RowDescriptor,
} from '@ad/catalog';
import { annotateCards, type TitleCardDto } from './annotate';
import { catalogContext, rulesOf, shared, type ViewerContext } from './context';
import { loadMyList } from './my-list';
import { videoPlayTarget, seriesPlayTarget, type PlayTarget } from './play-target';
import { audienceOf, loadOwnedProfile } from './profiles';
import { loadContinueWatching, type ContinueWatchingItem } from './progress';

export interface HeroItem {
  card: TitleCardDto;
  /** Wide artwork. Null falls back to the poster, then to a solid theme colour (M05-S01). */
  heroImage: ArtworkDto | null;
  play: PlayTarget | null;
}

export interface ContinueWatchingRow {
  id: string;
  kind: 'continue_watching';
  title: string;
  items: ContinueWatchingItem[];
  viewAll: null;
}

export interface TitleRow {
  id: string;
  kind: Exclude<RowKind, 'continue_watching' | 'hero'>;
  title: string;
  items: TitleCardDto[];
  /** Where View all goes, or null for no link (M41-S08). */
  viewAll: ViewAllTarget | null;
}

export type HomeRowDto = ContinueWatchingRow | TitleRow;

export interface HomeDto {
  /** Only on the first page. */
  hero: HeroItem[];
  rows: HomeRowDto[];
  /** Pass back to load the next batch of rows when they scroll near (M05-S04). */
  nextCursor: string | null;
  /** True when nothing is live for this profile, so the UI shows the empty state (M05-S07, M35-S01). */
  catalogEmpty: boolean;
}

export interface HomeInput {
  profileId: string;
  cursor?: string;
}

type PlanEntry = { descriptor: RowDescriptor } | { personal: 'continue_watching' | 'my_list' };

function isOffsetCursor(value: unknown): value is { o: number } {
  const candidate = value as { o: number };
  return (
    typeof candidate === 'object' &&
    candidate !== null &&
    Number.isInteger(candidate.o) &&
    candidate.o >= 0 &&
    candidate.o < 1000
  );
}

/**
 * Home for one profile: the hero, then rows in the order the editor set. Personal rows come first unless the
 * editor placed them. Rows with nothing to show are left out, and a failing kind of row cannot take the others
 * with it because each row resolves on its own (M05-S02 to M05-S06).
 */
export async function getHome(
  ctx: ViewerContext,
  actor: Actor,
  input: HomeInput,
): Promise<HomeDto> {
  return withAccount(ctx.db, actor, async (tx) => {
    const profile = await loadOwnedProfile(tx, actor, input.profileId);
    return buildHome(tx, ctx, audienceOf(profile), profile, input.cursor);
  });
}

/**
 * Home for a guest (M40): the same hero and rows for an audience, with no personal rows and no personal state.
 * It runs in a plain transaction with no profile, so it cannot read a personal table.
 */
export async function getGuestHome(
  ctx: ViewerContext,
  audience: Audience,
  input: { cursor?: string } = {},
): Promise<HomeDto> {
  return ctx.db.transaction((tx) =>
    buildHome(tx, ctx, { kids: audience.kids }, null, input.cursor),
  );
}

async function buildHome(
  tx: ViewerTx,
  ctx: ViewerContext,
  audience: Audience,
  profile: ProfileRow | null,
  cursor: string | undefined,
): Promise<HomeDto> {
  const rules = rulesOf(ctx);
  const offset = cursor === undefined ? 0 : decodeCursor(cursor, isOffsetCursor).o;
  const catalog = catalogContext(ctx);
  const rowRules = {
    trendingWindowDays: rules.trendingWindowDays,
    autoCategoryMax: rules.autoCategoryMax,
  };
  const descriptors = await shared(ctx, ['home-rows', audience.kids], async () =>
    expandRows(tx, catalog, audience, await listPublishedRows(tx, audience), rowRules),
  );
  const configured = profile ? await configuredRowKinds(tx) : new Set<string>();

  const plan: PlanEntry[] = [];
  if (profile && !configured.has('continue_watching')) plan.push({ personal: 'continue_watching' });
  if (profile && !configured.has('my_list')) plan.push({ personal: 'my_list' });
  plan.push(
    ...descriptors
      .filter((row) => row.kind !== 'hero')
      // A guest has no personal rows. A configured Continue Watching or My List row is simply left out.
      .filter((row) => profile || (row.kind !== 'continue_watching' && row.kind !== 'my_list'))
      .map((descriptor) => ({ descriptor })),
  );

  const rows: HomeRowDto[] = [];
  let index = offset;
  for (; index < plan.length && rows.length < rules.homeRowsPerPage; index++) {
    const entry = plan[index]!;
    if ('personal' in entry) {
      const personalRow = await resolvePersonalRow(tx, ctx, profile!, entry.personal);
      if (personalRow) rows.push(personalRow);
      continue;
    }
    const { descriptor } = entry;
    if (descriptor.kind === 'continue_watching' || descriptor.kind === 'my_list') {
      const personalRow = await resolvePersonalRow(tx, ctx, profile!, descriptor.kind, descriptor);
      if (personalRow) rows.push(personalRow);
      continue;
    }
    const resolved = await shared(ctx, ['home-row', audience.kids, descriptor.id], () =>
      resolveRow(tx, catalog, audience, descriptor, rowRules),
    );
    if (resolved.cards.length === 0) continue;
    rows.push({
      id: descriptor.id,
      kind: descriptor.kind as TitleRow['kind'],
      title: descriptor.title,
      items: await annotateCards(tx, profile?.id ?? null, resolved.cards),
      viewAll: resolved.viewAll,
    });
  }

  const hero = offset === 0 ? await buildHero(tx, ctx, profile, audience, descriptors) : [];
  const catalogEmpty = !(await hasLiveTitle(tx, catalog, audience));
  return {
    hero,
    rows,
    nextCursor: index < plan.length ? encodeCursor({ o: index }) : null,
    catalogEmpty,
  };
}

type ViewerTx = Parameters<Parameters<ViewerContext['db']['transaction']>[0]>[0];
type ProfileRow = Awaited<ReturnType<typeof loadOwnedProfile>>;

async function resolvePersonalRow(
  tx: ViewerTx,
  ctx: ViewerContext,
  profile: ProfileRow,
  kind: 'continue_watching' | 'my_list',
  descriptor?: RowDescriptor,
): Promise<HomeRowDto | null> {
  const rules = rulesOf(ctx);
  if (kind === 'continue_watching') {
    const items = await loadContinueWatching(tx, ctx, profile);
    if (items.length === 0) return null;
    return {
      id: descriptor?.id ?? 'personal:continue_watching',
      kind,
      title: descriptor?.title ?? 'Continue Watching',
      items,
      viewAll: null,
    };
  }
  const page = await loadMyList(tx, ctx, profile, { limit: rules.personalRowItems });
  if (page.items.length === 0) return null;
  return {
    id: descriptor?.id ?? 'personal:my_list',
    kind,
    title: descriptor?.title ?? 'My List',
    items: page.items.map((item) => item.card),
    viewAll: resolveViewAll({
      kind: 'my_list',
      mode: descriptor?.viewAllMode ?? 'auto',
      url: descriptor?.viewAllUrl ?? null,
    }),
  };
}

async function buildHero(
  tx: ViewerTx,
  ctx: ViewerContext,
  profile: ProfileRow | null,
  audience: Audience,
  descriptors: readonly RowDescriptor[],
): Promise<HeroItem[]> {
  const catalog = catalogContext(ctx);
  const cards = await heroCards(tx, catalog, audience, descriptors, rulesOf(ctx).heroFallbackCount);
  if (cards.length === 0) return [];
  const annotated = await annotateCards(tx, profile?.id ?? null, cards);
  const artwork = await fetchHeroArtwork(
    tx,
    catalog,
    cards.map((card) => ({ kind: card.kind, id: card.id })),
  );
  return Promise.all(
    annotated.map(async (card) => ({
      card,
      heroImage: artwork.get(card.id) ?? null,
      play:
        card.kind === 'series'
          ? await seriesPlayTarget(tx, ctx, audience, profile?.id ?? null, card.id)
          : videoPlayTarget(ctx, card, card.progress),
    })),
  );
}
