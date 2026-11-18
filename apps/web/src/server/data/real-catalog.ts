import {
  catalogContext,
  getHome,
  getTitleDetail,
  browse,
  listBrowseCategories,
  search,
  suggest,
  audienceOf,
  loadOwnedProfile,
  type EpisodeDto,
  type HomeRowDto,
  type SeriesDetailDto,
  type TitleDetailDto,
  type TitleCardDto,
  type VideoDetailDto,
  type ViewerContext as ServiceContext,
} from '@ad/viewer';
import { findTitle, popularTitles, type VideoCard } from '@ad/catalog';
import { withAccount } from '@ad/db';
import { NotFound, ValidationFailed } from '@ad/shared';
import type {
  BrowseQuery,
  CatalogItem,
  CatalogRepository,
  Category,
  Episode,
  HomeData,
  HomeRow,
  HomeRowsPage,
  Page,
  Progress,
  SeriesDetail,
  SeriesSummary,
  Suggestion,
  TitleDetail,
  VideoSummary,
  ViewerContext,
} from '../../lib/data/types';
import { viewerActor } from './actor';
import { cardToItem, durationBucketOf, toThumb } from './mappers';

const PAGE_SIZE = 12;
const POPULAR_COUNT = 4;

const emptyPage = (): Page<CatalogItem> => ({ items: [], total: 0, nextCursor: null });
const isPersonal = (row: HomeRowDto) => row.kind === 'continue_watching' || row.kind === 'my_list';

function seeAllHref(row: Exclude<HomeRowDto, { kind: 'continue_watching' }>): string | undefined {
  const target = row.seeAll;
  if (!target) return undefined;
  if (target.type === 'category') return `/browse/${target.slug}`;
  if (target.type === 'my_list') return '/my-list';
  return '/browse';
}

const asVideo = (item: CatalogItem): VideoSummary | null => (item.kind === 'video' ? item : null);

/** A video card from an episode or related list, with its place in a series when it has one. */
export function videoCardToSummary(
  card: VideoCard,
  categoryName = '',
  categorySlug = '',
): VideoSummary {
  return {
    kind: 'video',
    id: card.id,
    slug: card.slug,
    title: card.title,
    description: card.description ?? '',
    durationSeconds: Math.round(card.durationMs / 1000),
    categorySlug,
    categoryName,
    thumbnail: toThumb(card.poster),
    hasCaptions: card.hasCaptions,
    kidsSafe: card.kidsSafe,
    publishedAt: '',
    series: card.episode
      ? {
          slug: card.episode.seriesSlug,
          title: card.episode.seriesTitle,
          season: card.episode.seasonNumber,
          episode: card.episode.number,
        }
      : undefined,
  };
}

function progressOf(
  videoId: string,
  p: { positionMs: number; durationMs: number },
  updatedAt = '',
): Progress {
  return {
    videoId,
    positionSeconds: Math.round(p.positionMs / 1000),
    durationSeconds: Math.round(p.durationMs / 1000),
    updatedAt,
  };
}

/**
 * The catalog on the real services (lane C). Every call resolves the profile from the database and derives the
 * audience from it, so the audience a caller claims in `ctx` never widens what is shown.
 */
export class RealCatalog implements CatalogRepository {
  constructor(private readonly service: ServiceContext) {}

  private actor(ctx: ViewerContext) {
    return viewerActor(ctx.accountId);
  }

  /** The hero and the first page of rows. Later pages come from `homeRows` as the viewer scrolls (M05-S04). */
  async home(ctx: ViewerContext): Promise<HomeData> {
    const result = await getHome(this.service, this.actor(ctx), { profileId: ctx.profileId });
    if (result.catalogEmpty) return { hero: [], rows: [], empty: true };
    const hero = result.hero.map((slot) => {
      const item = cardToItem(slot.card);
      const wide = toThumb(slot.heroImage);
      return { item: wide ? { ...item, thumbnail: wide } : item };
    });
    return { hero, rows: this.catalogRows(result.rows), empty: false, nextCursor: result.nextCursor };
  }

  async homeRows(ctx: ViewerContext, cursor: string): Promise<HomeRowsPage> {
    const result = await getHome(this.service, this.actor(ctx), {
      profileId: ctx.profileId,
      cursor,
    });
    return { rows: this.catalogRows(result.rows), nextCursor: result.nextCursor };
  }

  private catalogRows(source: HomeRowDto[]): HomeRow[] {
    const rows: HomeRow[] = [];
    for (const row of source) {
      if (isPersonal(row) || row.kind === 'continue_watching') continue;
      const titleRow = row as Exclude<HomeRowDto, { kind: 'continue_watching' }>;
      rows.push({
        id: titleRow.id,
        title: titleRow.title,
        items: titleRow.items.map(cardToItem),
        seeAllHref: seeAllHref(titleRow),
      });
    }
    return rows;
  }

  async categories(ctx: ViewerContext) {
    const list = await listBrowseCategories(this.service, this.actor(ctx), {
      profileId: ctx.profileId,
    });
    return list.map<Category>((c) => ({
      slug: c.slug,
      name: c.name,
      description: c.description ?? '',
    }));
  }

  async browse(ctx: ViewerContext, query: BrowseQuery): Promise<Page<CatalogItem>> {
    const result = await browse(this.service, this.actor(ctx), {
      profileId: ctx.profileId,
      categorySlug: query.categorySlug,
      sort: query.sort,
      duration: durationBucketOf(query.length),
      limit: query.limit ?? PAGE_SIZE,
      cursor: query.cursor,
    });
    return {
      items: result.items.map(cardToItem),
      total: result.total,
      nextCursor: result.nextCursor,
    };
  }

  /** A query shorter than the minimum is an empty page, the screen shows its own prompt for that. */
  async search(ctx: ViewerContext, q: string, cursor?: string): Promise<Page<CatalogItem>> {
    try {
      const result = await search(this.service, this.actor(ctx), {
        profileId: ctx.profileId,
        query: q,
        limit: PAGE_SIZE,
        cursor,
        record: cursor === undefined,
      });
      return {
        items: result.items.map(cardToItem),
        total: result.total,
        nextCursor: result.nextCursor,
      };
    } catch (error) {
      if (error instanceof ValidationFailed) return emptyPage();
      throw error;
    }
  }

  async suggest(ctx: ViewerContext, q: string): Promise<Suggestion[]> {
    try {
      const found = await suggest(this.service, this.actor(ctx), {
        profileId: ctx.profileId,
        query: q,
      });
      return found.map<Suggestion>((s) =>
        s.kind === 'category'
          ? { type: 'category', label: s.label, href: `/browse/${s.slug}` }
          : {
              type: 'video',
              label: s.label,
              href: s.titleKind === 'series' ? `/series/${s.slug}` : `/title/${s.slug}`,
            },
      );
    } catch (error) {
      if (error instanceof ValidationFailed) return [];
      throw error;
    }
  }

  async popular(ctx: ViewerContext): Promise<VideoSummary[]> {
    const actor = this.actor(ctx);
    const cards = await withAccount(this.service.db, actor, async (tx) => {
      const profile = await loadOwnedProfile(tx, actor, ctx.profileId);
      return popularTitles(tx, catalogContext(this.service), audienceOf(profile), {
        limit: POPULAR_COUNT * 3,
        fallbackToNewest: true,
      });
    });
    return cards
      .map(cardToItem)
      .map(asVideo)
      .filter((v): v is VideoSummary => v !== null)
      .slice(0, POPULAR_COUNT);
  }

  private async detail(
    ctx: ViewerContext,
    slug: string,
    kind: 'video' | 'series',
  ): Promise<TitleDetailDto | null> {
    try {
      return await getTitleDetail(this.service, this.actor(ctx), {
        profileId: ctx.profileId,
        slug,
        kind,
      });
    } catch (error) {
      if (error instanceof NotFound) return null;
      throw error;
    }
  }

  async title(ctx: ViewerContext, slug: string) {
    const detail = await this.detail(ctx, slug, 'video');
    if (!detail) return null;
    if (detail.type === 'redirect') return { redirect: redirectPath(detail.to) };
    if (detail.type !== 'video') return null;
    return toTitleDetail(detail);
  }

  async publicTitle(slug: string): Promise<VideoSummary | null> {
    const catalog = catalogContext(this.service);
    const found = await this.service.db.transaction((tx) =>
      findTitle(tx, catalog, { kids: false }, { slug, kind: 'video' }),
    );
    if (!found || found.type !== 'title' || found.title.card.kind !== 'video') return null;
    const { card, categories, publishedAt } = found.title;
    return {
      ...(cardToItem(card) as VideoSummary),
      categorySlug: categories[0]?.slug ?? '',
      categoryName: categories[0]?.name ?? '',
      publishedAt: publishedAt ?? '',
    };
  }

  async series(ctx: ViewerContext, slug: string) {
    const detail = await this.detail(ctx, slug, 'series');
    if (!detail) return null;
    if (detail.type === 'redirect') return { redirect: redirectPath(detail.to) };
    if (detail.type !== 'series') return null;
    return toSeriesDetail(detail);
  }
}

function redirectPath(to: { kind: 'video' | 'series'; slug: string }): string {
  return to.kind === 'series' ? `/series/${to.slug}` : `/title/${to.slug}`;
}

function toTitleDetail(detail: VideoDetailDto): TitleDetail {
  const category = detail.categories[0];
  const base = cardToItem(detail.card) as VideoSummary;
  const video: VideoSummary = {
    ...base,
    categorySlug: category?.slug ?? '',
    categoryName: category?.name ?? '',
    publishedAt: detail.publishedAt ?? '',
  };
  const related = detail.related
    .map((card: TitleCardDto) => asVideo(cardToItem(card)))
    .filter((v): v is VideoSummary => v !== null);
  return {
    video,
    longDescription: detail.card.description ?? '',
    related,
    progress: detail.progress
      ? progressOf(video.id, detail.progress, detail.progress.updatedAt)
      : undefined,
    play: { label: detail.play.label, startSeconds: Math.round(detail.play.startMs / 1000) },
  };
}

function toSeriesDetail(detail: SeriesDetailDto): SeriesDetail {
  const category = detail.categories[0];
  const base = cardToItem(detail.card) as SeriesSummary;
  const series: SeriesSummary = {
    ...base,
    categorySlug: category?.slug ?? '',
    categoryName: category?.name ?? '',
    seasonCount: Math.max(detail.seasons.length, 1),
    publishedAt: detail.publishedAt ?? '',
  };
  const seasons = detail.seasons.map((season) => ({
    number: season.number,
    episodes: season.episodes.map<Episode>((e: EpisodeDto) => ({
      video: videoCardToSummary(e.video, series.categoryName, series.categorySlug),
      number: e.video.episode?.number ?? 0,
      blurb: e.video.description ?? '',
      progress: e.progress ? progressOf(e.video.id, e.progress) : undefined,
      watched: e.watched,
      current: e.isCurrent,
    })),
  }));
  const flat = seasons.flatMap((s) => s.episodes.map((e) => ({ season: s.number, episode: e })));
  const target = flat.find((x) => x.episode.video.id === detail.play?.videoId) ?? flat[0];
  const resume = detail.play?.label === 'resume';
  const left = target?.episode.progress
    ? target.episode.progress.durationSeconds - target.episode.progress.positionSeconds
    : undefined;
  return {
    series,
    seasons,
    next: {
      videoId: target?.episode.video.id ?? '',
      season: target?.season ?? 1,
      episode: target?.episode.number ?? 1,
      resume,
      secondsLeft: resume ? left : undefined,
      label: detail.play?.label ?? 'play',
    },
  };
}
