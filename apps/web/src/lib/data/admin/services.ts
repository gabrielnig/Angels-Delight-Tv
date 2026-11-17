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
import type {
  SeriesRecord,
  CategoryRecord,
  InviteRecord,
  Page,
  StaffRecord,
  UserRecord,
  VideoRecord,
} from './types';
import {
  changeRole,
  filterUsers,
  inviteStaff,
  maskEmail,
  reinstateUser,
  resendInvite,
  revokeInvite,
  revokeSessions,
  suspendUser,
} from './users-commands';
import { randomBytes } from 'node:crypto';
import { can } from '@/lib/admin/can';
import { discardJob, fixtureQuality, retryJob } from './system-rules';
import type { Quality } from './system-rules';
import type { JobRecord, StorageUsage } from './types';
import {
  changePassword,
  ensureAccount,
  regenerateRecoveryCodes,
  revokeSession,
  updateName,
} from './account-commands';
import type { FieldResult } from './account-commands';
import { fixtureEmailOf } from './session';
import type { MyAccount } from './types';
import type { DayRange } from '@ad/analytics';
import { buildFixtureOverview, buildFixtureVideo } from './analytics-rules';
import type { AnalyticsOverview, VideoAnalytics } from './analytics-rules';
import { filterAudit } from './audit-adapter';
import type { AuditQuery } from './audit-adapter';
import type { AuditRow } from './types';
import { buildDashboard } from './dashboard';
import type { DashboardData } from './dashboard';
import { getStore } from './store';
import { adminDataMode, delegating } from './mode';
import { validateConfig } from './home-rules';
import type { HomeConfig, HomeState } from './home-rules';
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

const fixtureDashboardService: DashboardService = {
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

/** Real data uses the upload API. Fixtures use the simulated transport. `ADMIN_UPLOADS` overrides either. */
export function uploadTransportMode(): 'fixture' | 'http' {
  if (process.env.ADMIN_UPLOADS === 'http') return 'http';
  if (process.env.ADMIN_UPLOADS === 'fixture') return 'fixture';
  return adminDataMode() === 'real' ? 'http' : 'fixture';
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

const fixtureVideoService: VideoService = {
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

const fixtureCaptionService: CaptionService = {
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

const fixtureCollectionService: CollectionService = {
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

export interface HomeData {
  state: HomeState;
  videos: VideoRecord[];
  series: SeriesRecord[];
  categories: CategoryRecord[];
}

export interface HomeService {
  get(actor: AdminActor): Promise<HomeData>;
  saveDraft(actor: AdminActor, config: HomeConfig): Promise<CommandResult>;
  publish(actor: AdminActor, config: HomeConfig): Promise<CommandResult>;
  restorePrevious(actor: AdminActor): Promise<CommandResult>;
}

const fixtureHomeService: HomeService = {
  async get(actor) {
    need(actor, 'home.curate');
    const s = getStore();
    return {
      state: structuredClone(s.home),
      videos: s.videos.filter((v) => v.deletedAt === null).map((v) => ({ ...v })),
      series: [...s.series],
      categories: [...s.categories].sort((a, b) => a.position - b.position),
    };
  },
  async saveDraft(actor, config) {
    need(actor, 'home.curate');
    const problem = validateConfig(config);
    if (problem) return { ok: false, error: problem };
    getStore().home.draft = structuredClone(config);
    return { ok: true };
  },
  async publish(actor, config) {
    need(actor, 'home.curate');
    const problem = validateConfig(config);
    if (problem) return { ok: false, error: problem };
    const home = getStore().home;
    home.previous = home.published;
    home.draft = structuredClone(config);
    home.published = structuredClone(config);
    home.publishedAt = new Date().toISOString();
    return { ok: true };
  },
  async restorePrevious(actor) {
    need(actor, 'home.curate');
    const home = getStore().home;
    if (!home.previous) return { ok: false, error: 'There is no earlier version to restore.' };
    const current = home.published;
    home.published = home.previous;
    home.draft = structuredClone(home.previous);
    home.previous = current;
    home.publishedAt = new Date().toISOString();
    return { ok: true };
  },
};

export interface PeopleService {
  users(
    actor: AdminActor,
    query: { q?: string; status?: 'active' | 'suspended' | '' },
  ): Promise<UserRecord[]>;
  user(actor: AdminActor, id: string): Promise<UserRecord>;
  suspend(actor: AdminActor, id: string, reason: string): Promise<CommandResult>;
  reinstate(actor: AdminActor, id: string): Promise<CommandResult>;
  revokeSessions(actor: AdminActor, id: string, reason: string): Promise<CommandResult>;
  staff(actor: AdminActor): Promise<{ staff: StaffRecord[]; invites: InviteRecord[] }>;
  /** Confirms the staff member's password so a sensitive action can follow (D-069). */
  reauthenticate(actor: AdminActor, password: string): Promise<CommandResult>;
  invite(actor: AdminActor, email: string, role: 'editor' | 'admin'): Promise<CommandResult>;
  resendInvite(actor: AdminActor, id: string): Promise<CommandResult>;
  revokeInvite(actor: AdminActor, id: string): Promise<CommandResult>;
  changeRole(actor: AdminActor, staffId: string, role: 'editor' | 'admin'): Promise<CommandResult>;
}

const shown = (actor: AdminActor, user: UserRecord): UserRecord =>
  can(actor.role, 'users.view') && actor.role === 'admin'
    ? { ...user }
    : { ...user, email: maskEmail(user.email) };

const fixturePeopleService: PeopleService = {
  async users(actor, query) {
    need(actor, 'users.view');
    return filterUsers(getStore().users, query).map((u) => shown(actor, u));
  },
  async user(actor, id) {
    need(actor, 'users.view');
    const user = getStore().users.find((u) => u.id === id);
    if (!user) throw new NotFound('User not found');
    return shown(actor, user);
  },
  async suspend(actor, id, reason) {
    need(actor, 'users.suspend');
    return suspendUser(getStore(), id, reason, actor.accountId, actor.name, Date.now());
  },
  async reinstate(actor, id) {
    need(actor, 'users.suspend');
    return reinstateUser(getStore(), id, actor.accountId, actor.name, Date.now());
  },
  async revokeSessions(actor, id, reason) {
    need(actor, 'users.suspend');
    return revokeSessions(getStore(), id, reason, actor.accountId, actor.name, Date.now());
  },
  async staff(actor) {
    need(actor, 'roles.change');
    const s = getStore();
    return { staff: structuredClone(s.staff), invites: structuredClone(s.invites) };
  },
  async reauthenticate(actor, password) {
    need(actor, 'roles.change');
    return password.length > 0 ? { ok: true } : { ok: false, error: 'Password is not right' };
  },
  async invite(actor, email, role) {
    need(actor, 'roles.change');
    return inviteStaff(getStore(), email, role, actor.accountId, actor.name, Date.now());
  },
  async resendInvite(actor, id) {
    need(actor, 'roles.change');
    return resendInvite(getStore(), id, actor.accountId, actor.name, Date.now());
  },
  async revokeInvite(actor, id) {
    need(actor, 'roles.change');
    return revokeInvite(getStore(), id, actor.accountId, actor.name, Date.now());
  },
  async changeRole(actor, staffId, role) {
    need(actor, 'roles.change');
    return changeRole(getStore(), staffId, role, actor.accountId, actor.name, Date.now());
  },
};

export const AUDIT_PAGE_SIZE = 25;
export const AUDIT_EXPORT_MAX = 5000;

export { adminDataMode };

export interface AuditService {
  list(
    actor: AdminActor,
    query: AuditQuery,
  ): Promise<{ items: AuditRow[]; nextCursor: string | null }>;
  get(actor: AdminActor, id: number): Promise<AuditRow>;
  exportRows(
    actor: AdminActor,
    query: AuditQuery,
  ): Promise<{ rows: AuditRow[]; total: number; truncated: boolean }>;
}

export const auditService: AuditService = {
  async list(actor, query) {
    need(actor, 'audit.read');
    if (adminDataMode() === 'real')
      return (await import('./audit-real')).realAudit.list(query, AUDIT_PAGE_SIZE);
    const all = filterAudit(getStore().audit, query);
    const start = query.cursor ? all.findIndex((r) => String(r.id) === query.cursor) : 0;
    const items = all.slice(Math.max(start, 0), Math.max(start, 0) + AUDIT_PAGE_SIZE);
    const next = all[Math.max(start, 0) + AUDIT_PAGE_SIZE];
    return { items: structuredClone(items), nextCursor: next ? String(next.id) : null };
  },
  async get(actor, id) {
    need(actor, 'audit.read');
    const row =
      adminDataMode() === 'real'
        ? await (await import('./audit-real')).realAudit.get(id)
        : (getStore().audit.find((r) => r.id === id) ?? null);
    if (!row) throw new NotFound('Entry not found');
    return structuredClone(row);
  },
  async exportRows(actor, query) {
    need(actor, 'audit.read');
    if (adminDataMode() === 'real') {
      const { rows, total } = await (
        await import('./audit-real')
      ).realAudit.exportRows(query, AUDIT_EXPORT_MAX);
      return { rows, total, truncated: total > rows.length };
    }
    const rows = filterAudit(getStore().audit, query);
    return { rows: structuredClone(rows), total: rows.length, truncated: false };
  },
};

export interface AnalyticsService {
  overview(actor: AdminActor, range: DayRange): Promise<AnalyticsOverview>;
  video(actor: AdminActor, id: string, range: DayRange): Promise<VideoAnalytics>;
}

export const analyticsService: AnalyticsService = {
  async overview(actor, range) {
    need(actor, 'analytics.view');
    if (adminDataMode() === 'real')
      return (await import('./analytics-real')).realAnalytics.overview(range);
    return buildFixtureOverview(getStore(), range);
  },
  async video(actor, id, range) {
    need(actor, 'analytics.view');
    const result =
      adminDataMode() === 'real'
        ? await (await import('./analytics-real')).realAnalytics.video(id, range)
        : buildFixtureVideo(getStore(), id, range);
    if (!result) throw new NotFound('Video not found');
    return result;
  },
};

export interface AccountService {
  get(actor: AdminActor): Promise<MyAccount>;
  updateName(actor: AdminActor, name: string): Promise<FieldResult>;
  changePassword(
    actor: AdminActor,
    current: string,
    next: string,
    confirm: string,
  ): Promise<FieldResult>;
  revokeSession(actor: AdminActor, sessionId: string): Promise<FieldResult>;
  regenerateCodes(
    actor: AdminActor,
    password: string,
  ): Promise<{ ok: false; field: string; error: string } | { ok: true; codes: string[] }>;
}

const own = (actor: AdminActor) =>
  ensureAccount(getStore(), actor, fixtureEmailOf(actor.accountId), Date.now());

/** Every call acts on the signed in person only. There is no account id parameter to forge. */
export const accountService: AccountService = {
  async get(actor) {
    need(actor, 'account.own');
    return structuredClone(own(actor));
  },
  async updateName(actor, name) {
    need(actor, 'account.own');
    own(actor);
    return updateName(getStore(), actor, name, Date.now());
  },
  async changePassword(actor, current, next, confirm) {
    need(actor, 'account.own');
    own(actor);
    return changePassword(getStore(), actor, current, next, confirm, Date.now());
  },
  async revokeSession(actor, sessionId) {
    need(actor, 'account.own');
    own(actor);
    return revokeSession(getStore(), actor, sessionId, Date.now());
  },
  async regenerateCodes(actor, password) {
    need(actor, 'account.own');
    own(actor);
    const generate = () =>
      randomBytes(5)
        .toString('hex')
        .replace(/^(.{5})/, '$1-');
    return regenerateRecoveryCodes(getStore(), actor, password, generate, Date.now());
  },
};

export interface SystemService {
  jobs(actor: AdminActor): Promise<JobRecord[]>;
  retryJob(actor: AdminActor, id: string): Promise<CommandResult>;
  discardJob(actor: AdminActor, id: string, reason: string): Promise<CommandResult>;
  storage(actor: AdminActor): Promise<StorageUsage[]>;
  quality(actor: AdminActor): Promise<Quality>;
}

/** Jobs and storage stay on fixtures until the queue and storage packages expose list and retry calls. Player quality is real with ADMIN_DATA=real. */
const fixtureSystemService: SystemService = {
  async jobs(actor) {
    need(actor, 'system.view');
    return structuredClone(getStore().jobs);
  },
  async retryJob(actor, id) {
    need(actor, 'system.view');
    return retryJob(getStore(), id, actor.accountId, actor.name, Date.now());
  },
  async discardJob(actor, id, reason) {
    need(actor, 'system.view');
    return discardJob(getStore(), id, reason, actor.accountId, actor.name, Date.now());
  },
  async storage(actor) {
    need(actor, 'system.view');
    return structuredClone(getStore().storage);
  },
  async quality(actor) {
    need(actor, 'system.view');
    if (adminDataMode() === 'real') return (await import('./analytics-quality-real')).realQuality();
    return fixtureQuality();
  },
};

// ---- Real or fixture, chosen per call (D-072) ----
export const videoService: VideoService = delegating(
  fixtureVideoService,
  async () => (await import('./real/videos')).realVideoService,
);
export const collectionService: CollectionService = delegating(
  fixtureCollectionService,
  async () => (await import('./real/collections')).realCollectionService,
);
export const homeService: HomeService = delegating(
  fixtureHomeService,
  async () => (await import('./real/home')).realHomeService,
);
export const dashboardService: DashboardService = delegating(
  fixtureDashboardService,
  async () => (await import('./real/dashboard')).realDashboardService,
);
export const systemService: SystemService = delegating(
  fixtureSystemService,
  async () => (await import('./real/system')).realSystemService,
);
export const captionService: CaptionService = delegating(
  fixtureCaptionService,
  async () => (await import('./real/captions')).realCaptionService,
);
export const peopleService: PeopleService = delegating(
  fixturePeopleService,
  async () => (await import('./real/people')).realPeopleService,
);
