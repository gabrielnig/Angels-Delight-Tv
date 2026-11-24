import type { ActivityPageData, CatalogItem, LibraryRepository, Page, Progress, VideoSummary, ViewerContext } from '../types';
import { PROGRESS, SEEDED_MY_LIST, VIDEOS } from './catalog-data';
import { listable, lookupItem } from './queries';

interface ProfileState {
  list: string[];
  progress: Map<string, Progress>;
  dismissed: Set<string>;
  removed: Map<string, Progress>;
}

const globalStore = globalThis as unknown as { __adFixtureLibrary?: Map<string, ProfileState> };
const store = (globalStore.__adFixtureLibrary ??= new Map<string, ProfileState>());

function stateFor(profileId: string): ProfileState {
  let state = store.get(profileId);
  if (!state) {
    state = {
      list: [...SEEDED_MY_LIST],
      progress: new Map(PROGRESS.map((p) => [p.videoId, p])),
      dismissed: new Set(),
      removed: new Map(),
    };
    store.set(profileId, state);
  }
  return state;
}

export function resetFixtureLibrary() {
  store.clear();
}

export function progressFor(profileId: string, videoId: string): Progress | undefined {
  return stateFor(profileId).progress.get(videoId);
}

export class FixtureLibrary implements LibraryRepository {
  async myList(ctx: ViewerContext, cursor?: string): Promise<Page<CatalogItem> & { hiddenCount: number }> {
    const state = stateFor(ctx.profileId);
    const allowed = new Set(listable(ctx).map((i) => (i.kind === 'video' ? `video:${i.id}` : `series:${i.slug}`)));
    const visible = [...state.list]
      .reverse()
      .filter((key) => allowed.has(key))
      .map((key) => lookupItem(key))
      .filter((item): item is CatalogItem => Boolean(item));
    const start = cursor ? Number.parseInt(cursor, 10) || 0 : 0;
    const items = visible.slice(start, start + 12);
    const end = start + items.length;
    return {
      items,
      total: visible.length,
      nextCursor: end < visible.length ? String(end) : null,
      hiddenCount: state.list.length - visible.length,
    };
  }

  async myListIds(ctx: ViewerContext): Promise<string[]> {
    return [...stateFor(ctx.profileId).list];
  }

  async addToList(ctx: ViewerContext, itemKey: string): Promise<void> {
    const state = stateFor(ctx.profileId);
    if (!state.list.includes(itemKey)) state.list.push(itemKey);
  }

  async removeFromList(ctx: ViewerContext, itemKey: string): Promise<void> {
    const state = stateFor(ctx.profileId);
    state.list = state.list.filter((key) => key !== itemKey);
  }

  async continueWatching(ctx: ViewerContext): Promise<Array<{ video: VideoSummary; progress: Progress }>> {
    const state = stateFor(ctx.profileId);
    const kids = ctx.audience === 'kids';
    return [...state.progress.values()]
      .filter((p) => !state.dismissed.has(p.videoId) && p.positionSeconds < p.durationSeconds * 0.95 && p.positionSeconds > 0)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map((progress) => ({ video: VIDEOS.find((v) => v.id === progress.videoId)!, progress }))
      .filter(({ video }) => Boolean(video) && (!kids || video.kidsSafe));
  }

  async removeFromContinue(ctx: ViewerContext, videoId: string): Promise<void> {
    stateFor(ctx.profileId).dismissed.add(videoId);
  }

  async activity(ctx: ViewerContext, cursor?: string): Promise<ActivityPageData> {
    const state = stateFor(ctx.profileId);
    const all = [...state.progress.values()]
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .flatMap((progress) => {
        const video = VIDEOS.find((v) => v.id === progress.videoId);
        return video ? [{ progress, video }] : [];
      });
    const start = cursor ? Number(cursor) || 0 : 0;
    const page = all.slice(start, start + 25);
    return {
      items: page.map(({ progress, video }) => ({
        videoId: video.id,
        title: video.title,
        seriesTitle: video.series?.title ?? null,
        episodeLabel: video.series ? `S${video.series.season} E${video.series.episode}` : null,
        slug: video.slug,
        posterUrl: null,
        posterAlt: null,
        watchedAt: progress.updatedAt,
        completed: progress.positionSeconds >= progress.durationSeconds * 0.95,
        progressPct: Math.min(100, Math.round((progress.positionSeconds / progress.durationSeconds) * 100)),
      })),
      nextCursor: start + 25 < all.length ? String(start + 25) : null,
    };
  }

  async removeActivity(ctx: ViewerContext, videoId: string): Promise<void> {
    const state = stateFor(ctx.profileId);
    const row = state.progress.get(videoId);
    if (row) state.removed.set(videoId, row);
    state.progress.delete(videoId);
  }

  async clearActivity(ctx: ViewerContext): Promise<{ cleared: number }> {
    const state = stateFor(ctx.profileId);
    const cleared = state.progress.size;
    state.progress.clear();
    state.removed.clear();
    return { cleared };
  }

  async restoreContinue(ctx: ViewerContext, videoId: string): Promise<void> {
    const state = stateFor(ctx.profileId);
    const back = state.removed.get(videoId);
    if (back) {
      state.progress.set(videoId, back);
      state.removed.delete(videoId);
    }
    state.dismissed.delete(videoId);
  }
}
