import 'server-only';
import { adminStatusOf, videoStub } from './video-rules';
import { Forbidden, NotFound, ValidationFailed } from '@ad/shared';
import type { BulkAction, BulkResult, VideoQuery } from './video-queries';
import { applyBulk, queryVideos } from './video-queries';
import { purgeVideo, restoreVideo, retryEncode, schedulePublish, validateVideoPatch } from './video-commands';
import type { PublishRequest, VideoPatch, CommandResult } from './video-commands';
import type { CategoryRecord, Page, VideoRecord } from './types';
import { can } from '@/lib/admin/can';
import { buildDashboard } from './dashboard';
import type { DashboardData } from './dashboard';
import { getStore } from './store';
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
  update(actor: AdminActor, id: string, patch: VideoPatch): Promise<VideoRecord>;
  bulk(actor: AdminActor, ids: string[], action: BulkAction): Promise<BulkResult>;
  publish(actor: AdminActor, id: string, request: PublishRequest): Promise<CommandResult>;
  unpublish(actor: AdminActor, id: string): Promise<CommandResult>;
  setPoster(actor: AdminActor, id: string, posterId: string): Promise<CommandResult>;
  retryEncode(actor: AdminActor, id: string): Promise<CommandResult>;
  trashed(actor: AdminActor): Promise<VideoRecord[]>;
  restore(actor: AdminActor, id: string): Promise<CommandResult>;
  purge(actor: AdminActor, id: string): Promise<CommandResult>;
  encodingQueue(actor: AdminActor): Promise<VideoRecord[]>;
  /** Fixture only: the real upload API creates the draft video itself. */
  createFromUpload(actor: AdminActor, input: { name: string; sizeBytes: number }): Promise<{ id: string }>;
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
  async update(actor, id, patch) {
    need(actor, 'video.edit');
    const store = getStore();
    const video = store.videos.find((v) => v.id === id && v.deletedAt === null);
    if (!video) throw new NotFound('Video not found');
    const result = validateVideoPatch(patch, new Set(store.categories.map((c) => c.id)));
    if (!result.ok) throw new ValidationFailed(Object.fromEntries(Object.entries(result.errors).map(([k, v]) => [k, [v]])));
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
  async setPoster(actor, id, posterId) {
    need(actor, 'video.edit');
    const video = getStore().videos.find((v) => v.id === id && v.deletedAt === null);
    if (!video) throw new NotFound('Video not found');
    video.posterId = posterId;
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
    return getStore().videos.filter((v) => v.deletedAt !== null).map((v) => ({ ...v }));
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
    const title = input.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
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
      .videos.filter((v) => v.deletedAt === null && ['uploaded', 'validating', 'encoding', 'failed'].includes(v.status))
      .map((v) => ({ ...v }));
  },
};
