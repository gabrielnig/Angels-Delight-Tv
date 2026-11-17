import { describe, expect, it } from 'vitest';
import { applyBulk, queryVideos, parseVideoQuery, serializeVideoQuery } from './video-queries';
import { seedStore } from './store';

const NOW = Date.parse('2026-11-17T09:00:00Z');
const fresh = () => seedStore(NOW);

describe('queryVideos', () => {
  it('hides trashed videos and sorts by last update', () => {
    const page = queryVideos(fresh().videos, {});
    expect(page.items.every((v) => v.deletedAt === null)).toBe(true);
    const times = page.items.map((v) => Date.parse(v.updatedAt));
    expect([...times].sort((a, b) => b - a)).toEqual(times);
    expect(page.total).toBe(12);
  });

  it('filters by search on title and tags', () => {
    expect(queryVideos(fresh().videos, { q: 'sky' }).items.map((v) => v.id)).toEqual(['vid_sky']);
    expect(queryVideos(fresh().videos, { q: 'DATA' }).items.map((v) => v.id)).toEqual(['vid_money_data']);
  });

  it('filters by status, category, captions and suitability', () => {
    expect(queryVideos(fresh().videos, { status: 'failed' }).items.map((v) => v.id)).toEqual(['vid_solar']);
    expect(queryVideos(fresh().videos, { categoryId: 'cat_maths' }).total).toBe(3);
    expect(queryVideos(fresh().videos, { captions: 'needs_review' }).items.map((v) => v.id)).toEqual(['vid_plants']);
    expect(queryVideos(fresh().videos, { suitability: 'kids' }).items.map((v) => v.id)).toEqual(['vid_hygiene']);
  });

  it('pages with a cursor and reports the next one', () => {
    const first = queryVideos(fresh().videos, { limit: 5 });
    expect(first.items).toHaveLength(5);
    expect(first.nextCursor).toBe('5');
    const last = queryVideos(fresh().videos, { limit: 5, cursor: '10' });
    expect(last.items).toHaveLength(2);
    expect(last.nextCursor).toBeNull();
  });

  it('sorts by title and views', () => {
    const byTitle = queryVideos(fresh().videos, { sort: 'title', dir: 'asc' }).items.map((v) => v.title);
    expect(byTitle).toEqual([...byTitle].sort((a, b) => a.localeCompare(b)));
    const byViews = queryVideos(fresh().videos, { sort: 'views', dir: 'desc' }).items;
    expect(byViews[0]!.id).toBe('vid_hygiene');
  });
});

describe('query string round trip', () => {
  it('parses and serializes only known, valid values', () => {
    expect(parseVideoQuery({ q: ' sky ', status: 'failed', sort: 'nope', dir: 'up', limit: '9999' })).toEqual({
      q: 'sky',
      status: 'failed',
      limit: 50,
    });
    expect(serializeVideoQuery({ q: 'sky', status: 'failed' })).toBe('q=sky&status=failed');
    expect(serializeVideoQuery({})).toBe('');
  });
});

describe('applyBulk', () => {
  const rules = { requireApprovedCaptions: true };

  it('publishes what is ready and reports the rest with a reason (partial failure)', () => {
    const store = fresh();
    const result = applyBulk(store.videos, ['vid_safe_online', 'vid_naira'], { type: 'publish' }, 'editor', rules, NOW);
    expect(result.succeeded).toEqual(['vid_safe_online']);
    expect(result.failed).toEqual([{ id: 'vid_naira', reason: expect.stringContaining('Not ready') }]);
    expect(store.videos.find((v) => v.id === 'vid_safe_online')!.publishState).toBe('published');
    expect(store.videos.find((v) => v.id === 'vid_naira')!.publishState).toBe('draft');
  });

  it('moves videos to trash only for admins', () => {
    const store = fresh();
    const denied = applyBulk(store.videos, ['vid_sky'], { type: 'trash' }, 'editor', rules, NOW);
    expect(denied.failed[0]!.reason).toBe('Only an admin can move videos to Trash.');
    const ok = applyBulk(store.videos, ['vid_sky'], { type: 'trash' }, 'admin', rules, NOW);
    expect(ok.succeeded).toEqual(['vid_sky']);
    expect(store.videos.find((v) => v.id === 'vid_sky')!.deletedAt).not.toBeNull();
  });

  it('adds a category once and unpublishes', () => {
    const store = fresh();
    applyBulk(store.videos, ['vid_sky'], { type: 'category', categoryId: 'cat_maths' }, 'editor', rules, NOW);
    applyBulk(store.videos, ['vid_sky'], { type: 'category', categoryId: 'cat_maths' }, 'editor', rules, NOW);
    expect(store.videos.find((v) => v.id === 'vid_sky')!.categoryIds.filter((c) => c === 'cat_maths')).toHaveLength(1);
    applyBulk(store.videos, ['vid_sky'], { type: 'unpublish' }, 'editor', rules, NOW);
    expect(store.videos.find((v) => v.id === 'vid_sky')!.publishState).toBe('unpublished');
  });

  it('refuses everything for a viewer', () => {
    const store = fresh();
    const result = applyBulk(store.videos, ['vid_sky'], { type: 'unpublish' }, 'viewer', rules, NOW);
    expect(result.succeeded).toEqual([]);
    expect(result.failed[0]!.reason).toBe('You do not have permission for this.');
  });

  it('reports a missing video', () => {
    const result = applyBulk(fresh().videos, ['nope'], { type: 'unpublish' }, 'editor', rules, NOW);
    expect(result.failed).toEqual([{ id: 'nope', reason: 'That video no longer exists.' }]);
  });
});
