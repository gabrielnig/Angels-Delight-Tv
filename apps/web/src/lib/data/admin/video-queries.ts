import type { AccountRole } from '@ad/shared';
import { can } from '@/lib/admin/can';
import type { AdminVideoStatus, CaptionState, Page, Suitability, VideoRecord } from './types';
import { adminStatusOf, canPublish } from './video-rules';
import type { PublishRules } from './video-rules';

export type VideoSort = 'updated' | 'title' | 'views' | 'published';

export interface VideoQuery {
  q?: string;
  status?: AdminVideoStatus;
  categoryId?: string;
  captions?: CaptionState;
  suitability?: Suitability;
  sort?: VideoSort;
  dir?: 'asc' | 'desc';
  cursor?: string;
  limit?: number;
}

const STATUSES: AdminVideoStatus[] = [
  'draft',
  'uploading',
  'processing',
  'needs_captions',
  'ready',
  'scheduled',
  'published',
  'failed',
];
const CAPTIONS: CaptionState[] = ['none', 'generating', 'needs_review', 'approved', 'failed'];
const SUITABILITY: Suitability[] = ['everyone', 'kids', 'older'];
const SORTS: VideoSort[] = ['updated', 'title', 'views', 'published'];

export function queryVideos(all: VideoRecord[], query: VideoQuery): Page<VideoRecord> {
  const q = query.q?.trim().toLowerCase();
  let items = all.filter((video) => video.deletedAt === null);
  if (q)
    items = items.filter(
      (v) => v.title.toLowerCase().includes(q) || v.tags.some((t) => t.toLowerCase().includes(q)),
    );
  if (query.status) items = items.filter((v) => adminStatusOf(v) === query.status);
  if (query.categoryId) items = items.filter((v) => v.categoryIds.includes(query.categoryId!));
  if (query.captions) items = items.filter((v) => v.captionState === query.captions);
  if (query.suitability) items = items.filter((v) => v.suitability === query.suitability);

  const sort = query.sort ?? 'updated';
  const dir = query.dir ?? (sort === 'title' ? 'asc' : 'desc');
  const key = (v: VideoRecord): number | string =>
    sort === 'title'
      ? v.title
      : sort === 'views'
        ? v.views
        : sort === 'published'
          ? Date.parse(v.publishedAt ?? v.publishAt ?? '') || 0
          : Date.parse(v.updatedAt);
  items = [...items].sort((a, b) => {
    const x = key(a);
    const y = key(b);
    const cmp =
      typeof x === 'string' ? x.localeCompare(y as string) : (x as number) - (y as number);
    return dir === 'asc' ? cmp : -cmp;
  });

  const limit = Math.min(50, Math.max(1, query.limit ?? 10));
  const start = Math.max(0, Number.parseInt(query.cursor ?? '0', 10) || 0);
  const slice = items.slice(start, start + limit);
  return {
    items: slice,
    total: items.length,
    nextCursor: start + limit < items.length ? String(start + limit) : null,
  };
}

type Raw = Record<string, string | string[] | undefined>;
const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** Reads the URL query. Unknown or invalid values are dropped. */
export function parseVideoQuery(raw: Raw): VideoQuery {
  const query: VideoQuery = {};
  const q = one(raw.q)?.trim();
  if (q) query.q = q;
  const status = one(raw.status) as AdminVideoStatus | undefined;
  if (status && STATUSES.includes(status)) query.status = status;
  const category = one(raw.category);
  if (category) query.categoryId = category;
  const captions = one(raw.captions) as CaptionState | undefined;
  if (captions && CAPTIONS.includes(captions)) query.captions = captions;
  const suitability = one(raw.suitability) as Suitability | undefined;
  if (suitability && SUITABILITY.includes(suitability)) query.suitability = suitability;
  const sort = one(raw.sort) as VideoSort | undefined;
  if (sort && SORTS.includes(sort)) query.sort = sort;
  const dir = one(raw.dir);
  if (dir === 'asc' || dir === 'desc') query.dir = dir;
  const cursor = one(raw.cursor);
  if (cursor && /^\d+$/.test(cursor)) query.cursor = cursor;
  const limit = Number.parseInt(one(raw.limit) ?? '', 10);
  if (Number.isFinite(limit) && limit > 0) query.limit = Math.min(50, limit);
  return query;
}

export function serializeVideoQuery(query: VideoQuery): string {
  const params = new URLSearchParams();
  if (query.q) params.set('q', query.q);
  if (query.status) params.set('status', query.status);
  if (query.categoryId) params.set('category', query.categoryId);
  if (query.captions) params.set('captions', query.captions);
  if (query.suitability) params.set('suitability', query.suitability);
  if (query.sort) params.set('sort', query.sort);
  if (query.dir) params.set('dir', query.dir);
  if (query.cursor) params.set('cursor', query.cursor);
  return params.toString();
}

export type BulkAction =
  | { type: 'publish' }
  | { type: 'unpublish' }
  | { type: 'trash' }
  | { type: 'category'; categoryId: string };

export interface BulkResult {
  succeeded: string[];
  failed: Array<{ id: string; reason: string }>;
}

/** Applies one action to many videos. Each id succeeds or fails alone so a bad one never blocks the rest. */
export function applyBulk(
  videos: VideoRecord[],
  ids: string[],
  action: BulkAction,
  role: AccountRole,
  rules: PublishRules,
  now: number,
): BulkResult {
  const result: BulkResult = { succeeded: [], failed: [] };
  const needed =
    action.type === 'trash'
      ? 'video.delete'
      : action.type === 'publish' || action.type === 'unpublish'
        ? 'video.publish'
        : 'video.edit';
  for (const id of ids) {
    const fail = (reason: string) => result.failed.push({ id, reason });
    const video = videos.find((v) => v.id === id && v.deletedAt === null);
    if (!video) {
      fail('That video no longer exists.');
      continue;
    }
    if (!can(role, needed)) {
      fail(
        action.type === 'trash' && can(role, 'video.edit')
          ? 'Only an admin can move videos to Trash.'
          : 'You do not have permission for this.',
      );
      continue;
    }
    const stamp = new Date(now).toISOString();
    if (action.type === 'publish') {
      const check = canPublish(video, rules);
      if (!check.ok) {
        fail(`Not ready: ${check.blockers[0]!.label} needs attention first.`);
        continue;
      }
      video.publishState = 'published';
      video.publishedAt = video.publishedAt ?? stamp;
      video.publishAt = null;
    } else if (action.type === 'unpublish') {
      video.publishState = 'unpublished';
    } else if (action.type === 'trash') {
      video.deletedAt = stamp;
    } else if (!video.categoryIds.includes(action.categoryId)) {
      video.categoryIds = [...video.categoryIds, action.categoryId];
    }
    video.updatedAt = stamp;
    result.succeeded.push(id);
  }
  return result;
}
