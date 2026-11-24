import type {
  BrowseQuery,
  ListPage,
  ListQuery,
  CatalogItem,
  CatalogRepository,
  Category,
  Episode,
  HomeData,
  HomeRow,
  HomeRowsPage,
  Page,
  Progress,
  PublicPreview,
  SeriesDetail,
  Suggestion,
  TitleDetail,
  VideoSummary,
  ViewerContext,
} from '../types';
import { CATEGORIES, SERIES, VIDEOS } from './catalog-data';
import { listable } from './queries';
import { progressFor } from './library';

function pageOf<T>(all: T[], cursor: string | undefined, limit: number): Page<T> {
  const start = cursor ? Number.parseInt(cursor, 10) || 0 : 0;
  const items = all.slice(start, start + limit);
  const end = start + items.length;
  return { items, total: all.length, nextCursor: end < all.length ? String(end) : null };
}

const matchesLength = (seconds: number, length: BrowseQuery['length']) => {
  if (length === 'short') return seconds < 180;
  if (length === 'medium') return seconds >= 180 && seconds <= 360;
  if (length === 'long') return seconds > 360;
  return true;
};

const seconds = (item: CatalogItem) => (item.kind === 'video' ? item.durationSeconds : item.episodeCount * 300);

function row(id: string, title: string, items: CatalogItem[], viewAllHref?: string): HomeRow | null {
  return items.length > 0
    ? {
        id,
        title,
        items: items.slice(0, 10),
        viewAll: viewAllHref ? { href: viewAllHref, external: false } : undefined,
      }
    : null;
}

function fixturePlay(progress: Progress | undefined): TitleDetail['play'] {
  if (!progress || progress.positionSeconds < 5) return { label: 'play', startSeconds: 0 };
  if (progress.positionSeconds >= progress.durationSeconds * 0.95) {
    return { label: 'watch_again', startSeconds: 0 };
  }
  return { label: 'resume', startSeconds: Math.max(0, progress.positionSeconds - 3) };
}

export class FixtureCatalog implements CatalogRepository {
  async homeRows(): Promise<HomeRowsPage> {
    return { rows: [], nextCursor: null };
  }

  async home(ctx: ViewerContext): Promise<HomeData> {
    const all = listable(ctx);
    if (all.length === 0) return { hero: [], rows: [], empty: true };
    const inCategory = (...slugs: string[]) => all.filter((i) => slugs.includes(i.categorySlug));
    const find = (slug: string) => all.find((i) => (i.kind === 'video' ? i.slug === slug : i.slug === slug));
    const heroSlugs =
      ctx.audience === 'kids'
        ? ['meet-the-elephant', 'the-little-goat']
        : ['how-plants-make-their-own-food', 'everyday-science', 'saving-a-little-each-day'];
    const hero = heroSlugs
      .map((slug) => find(slug))
      .filter((item): item is CatalogItem => Boolean(item))
      .map((item) => ({ item }));

    const rows =
      ctx.audience === 'kids'
        ? [
            row('animals', 'Animal friends', inCategory('nature'), '/browse/nature'),
            row('counting', 'Counting and shapes', inCategory('maths'), '/browse/maths'),
            row('stories', 'Songs and stories', inCategory('stories', 'songs'), '/browse/stories'),
          ]
        : [
            row('new', 'New this week', all, '/browse'),
            row('skills', 'Learn a skill', inCategory('life-skills', 'digital', 'english'), '/browse/life-skills'),
            row('science', 'Science made simple', inCategory('science'), '/browse/science'),
            row('health', 'Health', inCategory('health'), '/browse/health'),
          ];
    return { hero, rows: rows.filter((r): r is HomeRow => r !== null), empty: false };
  }

  async categories(ctx: ViewerContext): Promise<Category[]> {
    const present = new Set(listable(ctx).map((i) => i.categorySlug));
    return CATEGORIES.filter((c) => present.has(c.slug));
  }

  async browse(ctx: ViewerContext, query: BrowseQuery): Promise<Page<CatalogItem>> {
    let items = listable(ctx);
    if (query.categorySlug) items = items.filter((i) => i.categorySlug === query.categorySlug);
    items = items.filter((i) => matchesLength(seconds(i), query.length));
    if (query.sort === 'shortest') items = [...items].sort((a, b) => seconds(a) - seconds(b));
    else if (query.sort === 'longest') items = [...items].sort((a, b) => seconds(b) - seconds(a));
    else if (query.sort === 'az') items = [...items].sort((a, b) => a.title.localeCompare(b.title));
    return pageOf(items, query.cursor, query.limit ?? 10);
  }

  async browseList(ctx: ViewerContext, query: ListQuery): Promise<ListPage | null> {
    const all = listable(ctx);
    if (query.list === 'row') return null;
    const titles = { new: 'New this week', trending: 'Trending', series: 'Series' } as const;
    const items =
      query.list === 'series'
        ? all.filter((i) => i.kind === 'series')
        : query.list === 'trending'
          ? all.slice(0, 50)
          : all;
    const page = pageOf(items, query.cursor, query.list === 'new' ? 10 : 50);
    return { ...page, title: titles[query.list] };
  }

  async search(ctx: ViewerContext, q: string, cursor?: string): Promise<Page<CatalogItem>> {
    const needle = q.trim().toLowerCase();
    if (needle === 'fail') throw new Error('Search backend unavailable');
    const terms = needle.split(/\s+/).filter(Boolean);
    const hits = listable(ctx).filter((item) => {
      const haystack = `${item.title} ${item.description} ${item.categoryName}`.toLowerCase();
      return terms.length > 0 && terms.every((term) => haystack.includes(term));
    });
    return pageOf(hits, cursor, 10);
  }

  async suggest(ctx: ViewerContext, q: string): Promise<Suggestion[]> {
    const needle = q.trim().toLowerCase();
    if (needle.length < 2) return [];
    const kids = ctx.audience === 'kids';
    const titles: Suggestion[] = listable(ctx)
      .filter((i) => i.title.toLowerCase().includes(needle))
      .slice(0, 4)
      .map((i) => ({
        type: 'video' as const,
        label: i.title,
        href: i.kind === 'video' ? `/title/${i.slug}` : `/series/${i.slug}`,
      }));
    // Kids profiles only get approved titles, never category prompts beyond them.
    const cats: Suggestion[] = kids
      ? []
      : CATEGORIES.filter((c) => c.name.toLowerCase().includes(needle))
          .slice(0, 2)
          .map((c) => ({ type: 'category' as const, label: c.name, href: `/browse/${c.slug}` }));
    return [...titles, ...cats];
  }

  async popular(ctx: ViewerContext): Promise<VideoSummary[]> {
    return listable(ctx)
      .filter((i): i is VideoSummary => i.kind === 'video')
      .slice(0, 4);
  }

  async title(ctx: ViewerContext, slug: string): Promise<TitleDetail | { blocked: 'kids' } | null> {
    const video = VIDEOS.find((v) => v.slug === slug);
    if (!video) return null;
    if (ctx.audience === 'kids' && !video.kidsSafe) return { blocked: 'kids' };
    const related = VIDEOS.filter(
      (v) => v.categorySlug === video.categorySlug && v.id !== video.id && !v.series && (ctx.audience === 'adult' || v.kidsSafe),
    ).slice(0, 8);
    return {
      video,
      longDescription: `${video.description} Watch at your own pace, pause any time and come back where you stopped.`,
      credits: video.series ? undefined : 'Presented by the Angels Delight team. Captions in English.',
      related,
      progress: progressFor(ctx.profileId, video.id),
      play: fixturePlay(progressFor(ctx.profileId, video.id)),
    };
  }

  async publicTitle(slug: string): Promise<VideoSummary | null> {
    return VIDEOS.find((v) => v.slug === slug && !v.series) ?? null;
  }

  async publicPreview(slug: string, kind: 'video' | 'series'): Promise<PublicPreview | null> {
    if (kind === 'series') {
      const series = SERIES.find((s) => s.slug === slug);
      return series ? { type: 'series', item: series } : null;
    }
    const video = VIDEOS.find((v) => v.slug === slug);
    if (!video) return null;
    return video.series
      ? { type: 'redirect', to: `/series/${video.series.slug}` }
      : { type: 'video', item: video };
  }

  async series(ctx: ViewerContext, slug: string): Promise<SeriesDetail | null> {
    const series = SERIES.find((s) => s.slug === slug);
    if (!series || (ctx.audience === 'kids' && !series.kidsSafe)) return null;
    const videos = VIDEOS.filter((v) => v.series?.slug === slug);
    const seasonNumbers = [...new Set(videos.map((v) => v.series!.season))].sort();
    const seasons = seasonNumbers.map((number) => ({
      number,
      episodes: videos
        .filter((v) => v.series!.season === number)
        .map<Episode>((video) => {
          const progress = progressFor(ctx.profileId, video.id);
          return {
            video,
            number: video.series!.episode,
            blurb: video.description,
            progress,
            watched: Boolean(progress && progress.positionSeconds >= progress.durationSeconds * 0.95),
            current: false,
          };
        }),
    }));
    const flat = seasons.flatMap((s) => s.episodes.map((e) => ({ s: s.number, e })));
    const inProgress = flat.find(({ e }) => e.progress && !e.watched);
    const firstUnwatched = flat.find(({ e }) => !e.watched) ?? flat[0];
    const target = inProgress ?? firstUnwatched;
    target!.e.current = true;
    return {
      series,
      seasons,
      next: {
        videoId: target!.e.video.id,
        season: target!.s,
        episode: target!.e.number,
        resume: Boolean(inProgress),
        secondsLeft: inProgress?.e.progress
          ? inProgress.e.progress.durationSeconds - inProgress.e.progress.positionSeconds
          : undefined,
        label: inProgress ? 'resume' : 'play',
      },
    };
  }
}
