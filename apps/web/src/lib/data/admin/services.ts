import 'server-only';
import { validatePosterChoice } from '@/lib/admin/poster-rules';
import type { PosterChoice } from '@/lib/admin/poster-rules';
import { adminStatusOf, videoStub } from './video-rules';
import { Forbidden, NotFound, ValidationFailed } from '@ad/shared';
import type { BulkAction, BulkResult, VideoQuery } from './video-queries';
import { applyBulk, queryVideos } from './video-queries';
import {
  purgeVideo,
  restoreVideo,
  retryEncode,
  schedulePublish,
  validateVideoPatch,
} from './video-commands';
import type { PublishRequest, VideoPatch, CommandResult } from './video-commands';
import type { SeriesRecord, CategoryRecord, Page, VideoRecord } from './types';
import { can } from '@/lib/admin/can';
import { buildDashboard } from './dashboard';
import type { DashboardData } from './dashboard';
import { getStore } from './store';
import {
  categoryVideoCount,
  createCategory,
  createSeries,
  deleteCategory,
  deleteSeries,
  moveCategory,
  renameCategory,
  setCategoryHidden,
  setEpisode,
  updateSeries,
} from './collection-commands';
import type { SeriesPatch } from './collection-commands';
import type { AdminActor } from './types';

/**
 * Typed data access for the admin UI. These interfaces are the seam: fixtures answer today, the
 * real services from the content, pipeline and auth lanes replace the bodies later. Every call
 * takes the actor and re-checks permission (never trust the page alone).
 */
export interface DashboardService {
  get(actor: AdminActor, options?: { failTiles?: string[] }): Promise<DashboardData>;
  navCounts(actor: AdminActor): Promise<{ encoding: number; captions: number }>;
}

export const dashboardService: DashboardService = {
  async get(actor, options) {
    if (!can(actor.role, 'admin.access')) throw new Error('forbidden');
    return buildDashboard(actor, getStore(), options);
  },
  async navCounts(actor) {
    if (!can(actor.role, 'admin.access')) return { encoding: 0, captions: 0 };
    const live = getStore().videos.filter((v) => v.deletedAt === null);
    return {
      encoding: live.filter((v) => adminStatusOf(v) === 'processing').length,
      captions: live.filter((v) => v.captionState === 'needs_review').length,
    };
  },
};

/** 'fixture' until the upload API is wired. The client picks its transport from this. */
export function uploadTransportMode(): 'fixture' | 'http' {
  return process.env.ADMIN_UPLOADS === 'http' ? 'http' : 'fixture';
}

// ---- Videos ----

export interface VideoService {
  list(actor: AdminActor, query: VideoQuery): Promise<Page<VideoRecord>>;
  get(actor: AdminActor, id: string): Promise<VideoRecord>;
  categories(actor: AdminActor): Promise<CategoryRecord[]>;
  seriesOptions(actor: AdminActor): Promise<SeriesRecord[]>;
  update(actor: AdminActor, id: string, patch: VideoPatch): Promise<VideoRecord>;
  bulk(actor: AdminActor, ids: string[], action: BulkAction): Promise<BulkResult>;
  publish(actor: AdminActor, id: string, request: PublishRequest): Promise<CommandResult>;
  unpublish(actor: AdminActor, id: string): Promise<CommandResult>;
  setPoster(actor: AdminActor, id: string, choice: PosterChoice): Promise<CommandResult>;
  retryEncode(actor: AdminActor, id: string): Promise<CommandResult>;
  trashed(actor: AdminActor): Promise<VideoRecord[]>;
  restore(actor: AdminActor, id: string): Promise<CommandResult>;
  purge(actor: AdminActor, id: string): Promise<CommandResult>;
  encodingQueue(actor: AdminActor): Promise<VideoRecord[]>;
  /** Fixture only: the real upload API creates the draft video itself. */
  createFromUpload(
    actor: AdminActor,
    input: { name: string; sizeBytes: number },
  ): Promise<{ id: string }>;
}

function need(actor: AdminActor, action: Parameters<typeof can>[1]) {
  if (!can(actor.role, action)) throw new Forbidden();
}

export const videoService: VideoService = {
  async list(actor, query) {
    need(actor, 'admin.access');
    return queryVideos(getStore().videos, query);
  },
  async get(actor, id) {
    need(actor, 'admin.access');
    const video = getStore().videos.find((v) => v.id === id && v.deletedAt === null);
    if (!video) throw new NotFound('Video not found');
    return { ...video };
  },
  async categories(actor) {
    need(actor, 'admin.access');
    return [...getStore().categories].sort((a, b) => a.position - b.position);
  },
  async seriesOptions(actor) {
    need(actor, 'admin.access');
    return [...getStore().series];
  },
  async update(actor, id, patch) {
    need(actor, 'video.edit');
    const store = getStore();
    const video = store.videos.find((v) => v.id === id && v.deletedAt === null);
    if (!video) throw new NotFound('Video not found');
    const result = validateVideoPatch(patch, new Set(store.categories.map((c) => c.id)));
    if (!result.ok)
      throw new ValidationFailed(
        Object.fromEntries(Object.entries(result.errors).map(([k, v]) => [k, [v]])),
      );
    Object.assign(video, result.value, { updatedAt: new Date().toISOString() });
    return { ...video };
  },
  async bulk(actor, ids, action) {
    need(actor, 'admin.access');
    const store = getStore();
    return applyBulk(store.videos, ids, action, actor.role, store.settings, Date.now());
  },
  async publish(actor, id, request) {
    need(actor, 'video.publish');
    const store = getStore();
    const video = store.videos.find((v) => v.id === id && v.deletedAt === null);
    if (!video) throw new NotFound('Video not found');
    return schedulePublish(video, request, actor.role, store.settings, Date.now());
  },
  async unpublish(actor, id) {
    need(actor, 'video.publish');
    const video = getStore().videos.find((v) => v.id === id && v.deletedAt === null);
    if (!video) throw new NotFound('Video not found');
    video.publishState = 'unpublished';
    video.updatedAt = new Date().toISOString();
    return { ok: true };
  },
  async setPoster(actor, id, choice) {
    need(actor, 'video.edit');
    const errors = validatePosterChoice(choice);
    if (Object.keys(errors).length) return { ok: false, error: Object.values(errors)[0]! };
    const video = getStore().videos.find((v) => v.id === id && v.deletedAt === null);
    if (!video) throw new NotFound('Video not found');
    video.posterId = choice.posterId;
    video.posterAlt = choice.alt.trim();
    video.posterFocus = { ...choice.focus, zoom: choice.zoom };
    video.updatedAt = new Date().toISOString();
    return { ok: true };
  },
  async retryEncode(actor, id) {
    need(actor, 'video.edit');
    const video = getStore().videos.find((v) => v.id === id);
    if (!video) throw new NotFound('Video not found');
    return retryEncode(video, Date.now());
  },
  async trashed(actor) {
    need(actor, 'video.restore');
    return getStore()
      .videos.filter((v) => v.deletedAt !== null)
      .map((v) => ({ ...v }));
  },
  async restore(actor, id) {
    return restoreVideo(getStore().videos, id, actor.role);
  },
  async purge(actor, id) {
    return purgeVideo(getStore().videos, id, actor.role);
  },
  async createFromUpload(actor, input) {
    need(actor, 'video.upload');
    const store = getStore();
    const stamp = new Date().toISOString();
    const title = input.name
      .replace(/\.[^.]+$/, '')
      .replace(/[_-]+/g, ' ')
      .trim();
    const video = videoStub({
      id: `vid_${Math.random().toString(36).slice(2, 10)}`,
      title,
      status: 'encoding',
      progress: 5,
      sizeBytes: input.sizeBytes,
      uploadedBy: actor.name,
      createdAt: stamp,
      updatedAt: stamp,
      durationSeconds: 240,
    });
    store.videos.unshift(video);
    return { id: video.id };
  },
  async encodingQueue(actor) {
    need(actor, 'video.edit');
    // Fixture: each look at the queue moves encoding along, so the live screen shows progress.
    for (const v of getStore().videos) {
      if (v.status === 'encoding' && v.deletedAt === null) {
        v.progress = Math.min(100, v.progress + 8);
        if (v.progress >= 100) {
          v.status = 'ready';
          v.captionState = 'needs_review';
          v.captionCueCount = 60;
        }
      }
    }
    return getStore()
      .videos.filter(
        (v) =>
          v.deletedAt === null &&
          ['uploaded', 'validating', 'encoding', 'failed'].includes(v.status),
      )
      .map((v) => ({ ...v }));
  },
};

// ---- Captions ----
import {
  approveTrack,
  ensureTrack,
  regenerateTrack,
  replaceCues,
  saveCues,
} from './caption-commands';
import type { SaveResult, CaptionResult } from './caption-commands';
import type { Cue } from '@/lib/admin/cues';
import type { CaptionState, CaptionTrack } from './types';

export interface CaptionRow {
  videoId: string;
  title: string;
  state: CaptionState;
  language: string;
  cueCount: number | null;
  lastEditedBy: string;
  lastEditedAt: string | null;
}

export interface CaptionService {
  list(actor: AdminActor, filter?: { state?: CaptionState }): Promise<CaptionRow[]>;
  track(
    actor: AdminActor,
    videoId: string,
  ): Promise<{ track: CaptionTrack | null; video: VideoRecord }>;
  save(actor: AdminActor, videoId: string, cues: Cue[]): Promise<SaveResult>;
  approve(actor: AdminActor, videoId: string): Promise<CaptionResult>;
  regenerate(actor: AdminActor, videoId: string): Promise<CaptionResult>;
  upload(actor: AdminActor, videoId: string, cues: Cue[]): Promise<CaptionResult>;
}

function liveVideo(id: string) {
  const video = getStore().videos.find((v) => v.id === id && v.deletedAt === null);
  if (!video) throw new NotFound('Video not found');
  return video;
}

export const captionService: CaptionService = {
  async list(actor, filter) {
    need(actor, 'caption.review');
    const store = getStore();
    const now = Date.now();
    const rows = store.videos
      .filter((v) => v.deletedAt === null && v.status === 'ready')
      .map((video): CaptionRow => {
        const track = ensureTrack(store, video, now);
        return {
          videoId: video.id,
          title: video.title,
          state: track?.state ?? 'none',
          language: 'English',
          cueCount: track && track.cues.length ? track.cues.length : null,
          lastEditedBy: track?.updatedBy ?? 'Not started',
          lastEditedAt: track?.updatedAt ?? null,
        };
      });
    const filtered = filter?.state ? rows.filter((r) => r.state === filter.state) : rows;
    return filtered.sort(
      (a, b) => Date.parse(a.lastEditedAt ?? '') - Date.parse(b.lastEditedAt ?? ''),
    );
  },
  async track(actor, videoId) {
    need(actor, 'caption.review');
    const video = liveVideo(videoId);
    const track = ensureTrack(getStore(), video, Date.now());
    return { track: track ? structuredClone(track) : null, video: { ...video } };
  },
  async save(actor, videoId, cues) {
    return saveCues(getStore(), liveVideo(videoId), cues, actor.role, actor.name, Date.now());
  },
  async approve(actor, videoId) {
    return approveTrack(getStore(), liveVideo(videoId), actor.role, actor.name, Date.now());
  },
  async regenerate(actor, videoId) {
    return regenerateTrack(getStore(), liveVideo(videoId), actor.role, Date.now());
  },
  async upload(actor, videoId, cues) {
    return replaceCues(getStore(), liveVideo(videoId), cues, actor.role, actor.name, Date.now());
  },
};

export interface CategoryRow extends CategoryRecord {
  videoCount: number;
}
export interface SeriesRow extends SeriesRecord {
  episodeCount: number;
}
export interface SeriesDetail {
  series: SeriesRecord;
  episodes: VideoRecord[];
  available: VideoRecord[];
}

export interface CollectionService {
  categories(actor: AdminActor): Promise<CategoryRow[]>;
  createCategory(actor: AdminActor, name: string): Promise<CommandResult>;
  renameCategory(actor: AdminActor, id: string, name: string): Promise<CommandResult>;
  setCategoryHidden(actor: AdminActor, id: string, hidden: boolean): Promise<CommandResult>;
  moveCategory(actor: AdminActor, id: string, delta: -1 | 1): Promise<CommandResult>;
  deleteCategory(actor: AdminActor, id: string): Promise<CommandResult>;
  seriesList(actor: AdminActor): Promise<SeriesRow[]>;
  seriesDetail(actor: AdminActor, id: string): Promise<SeriesDetail>;
  createSeries(
    actor: AdminActor,
    input: { title: string; description: string },
  ): Promise<CommandResult>;
  updateSeries(actor: AdminActor, id: string, patch: SeriesPatch): Promise<CommandResult>;
  deleteSeries(actor: AdminActor, id: string): Promise<CommandResult>;
  setEpisode(
    actor: AdminActor,
    videoId: string,
    seriesId: string | null,
    season: number | null,
    episode: number | null,
  ): Promise<CommandResult>;
}

export const collectionService: CollectionService = {
  async categories(actor) {
    need(actor, 'category.manage');
    const s = getStore();
    return [...s.categories]
      .sort((a, b) => a.position - b.position)
      .map((c) => ({ ...c, videoCount: categoryVideoCount(s, c.id) }));
  },
  async createCategory(actor, name) {
    need(actor, 'category.manage');
    return createCategory(getStore(), name);
  },
  async renameCategory(actor, id, name) {
    need(actor, 'category.manage');
    return renameCategory(getStore(), id, name);
  },
  async setCategoryHidden(actor, id, hidden) {
    need(actor, 'category.manage');
    return setCategoryHidden(getStore(), id, hidden);
  },
  async moveCategory(actor, id, delta) {
    need(actor, 'category.manage');
    return moveCategory(getStore(), id, delta);
  },
  async deleteCategory(actor, id) {
    need(actor, 'category.manage');
    return deleteCategory(getStore(), id);
  },
  async seriesList(actor) {
    need(actor, 'series.manage');
    const s = getStore();
    return s.series.map((x) => ({
      ...x,
      episodeCount: s.videos.filter((v) => v.seriesId === x.id && v.deletedAt === null).length,
    }));
  },
  async seriesDetail(actor, id) {
    need(actor, 'series.manage');
    const s = getStore();
    const series = s.series.find((x) => x.id === id);
    if (!series) throw new NotFound('Series not found');
    const live = s.videos.filter((v) => v.deletedAt === null);
    const episodes = live
      .filter((v) => v.seriesId === id)
      .sort(
        (a, b) =>
          (a.seasonNumber ?? 1) - (b.seasonNumber ?? 1) ||
          (a.episodeNumber ?? 0) - (b.episodeNumber ?? 0),
      );
    return { series: { ...series }, episodes, available: live.filter((v) => v.seriesId === null) };
  },
  async createSeries(actor, input) {
    need(actor, 'series.manage');
    return createSeries(getStore(), input);
  },
  async updateSeries(actor, id, patch) {
    need(actor, 'series.manage');
    return updateSeries(getStore(), id, patch);
  },
  async deleteSeries(actor, id) {
    need(actor, 'series.manage');
    return deleteSeries(getStore(), id);
  },
  async setEpisode(actor, videoId, seriesId, season, episode) {
    need(actor, 'series.manage');
    return setEpisode(getStore(), videoId, seriesId, season, episode);
  },
};
