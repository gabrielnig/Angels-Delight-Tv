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
    expect(queryVideos(fresh().videos, { q: 'DATA' }).items.map((v) => v.id)).toEqual([
      'vid_money_data',
    ]);
  });

  it('filters by status, category, captions and suitability', () => {
    expect(queryVideos(fresh().videos, { status: 'failed' }).items.map((v) => v.id)).toEqual([
      'vid_solar',
    ]);
    expect(queryVideos(fresh().videos, { categoryId: 'cat_maths' }).total).toBe(3);
    expect(
      queryVideos(fresh().videos, { captions: 'needs_review' }).items.map((v) => v.id),
    ).toEqual(['vid_plants']);
    expect(queryVideos(fresh().videos, { suitability: 'kids' }).items.map((v) => v.id)).toEqual([
      'vid_hygiene',
    ]);
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
    const byTitle = queryVideos(fresh().videos, { sort: 'title', dir: 'asc' }).items.map(
      (v) => v.title,
    );
    expect(byTitle).toEqual([...byTitle].sort((a, b) => a.localeCompare(b)));
    const byViews = queryVideos(fresh().videos, { sort: 'views', dir: 'desc' }).items;
    expect(byViews[0]!.id).toBe('vid_hygiene');
  });
});

describe('query string round trip', () => {
  it('parses and serializes only known, valid values', () => {
    expect(
      parseVideoQuery({ q: ' sky ', status: 'failed', sort: 'nope', dir: 'up', limit: '9999' }),
    ).toEqual({
      q: 'sky',
      status: 'failed',
      limit: 50,
    });
    expect(parseVideoQuery({ cursor: 'eyJrIjoiMSIsImkiOiJ4In0' }).cursor).toBe(
      'eyJrIjoiMSIsImkiOiJ4In0',
    );
    expect(parseVideoQuery({ cursor: '<script>' }).cursor).toBeUndefined();
    expect(serializeVideoQuery({ q: 'sky', status: 'failed' })).toBe('q=sky&status=failed');
    expect(serializeVideoQuery({})).toBe('');
  });
});

describe('applyBulk', () => {
  const rules = { requireApprovedCaptions: true };

  it('publishes what is ready and reports the rest with a reason (partial failure)', () => {
    const store = fresh();
    const result = applyBulk(
      store.videos,
      ['vid_safe_online', 'vid_naira'],
      { type: 'publish' },
      'editor',
      rules,
      NOW,
    );
    expect(result.succeeded).toEqual(['vid_safe_online']);
    expect(result.failed).toEqual([
      { id: 'vid_naira', reason: expect.stringContaining('Not ready') },
    ]);
    expect(store.videos.find((v) => v.id === 'vid_safe_online')!.publishState).toBe('published');
    expect(store.videos.find((v) => v.id === 'vid_naira')!.publishState).toBe('draft');
  });

  it('captions_available applies a tri state to every id and fails each id alone', () => {
    const store = fresh();
    const off = { type: 'captions_available', value: false, reason: 'No spoken words' } as const;
    const ok = applyBulk(store.videos, ['vid_sky', 'vid_naira'], off, 'admin', rules, NOW);
    expect(ok.succeeded).toEqual(['vid_sky', 'vid_naira']);
    const sky = store.videos.find((v) => v.id === 'vid_sky')!;
    expect(sky.captionsEnabled).toBe(false);
    expect(sky.captionsOffReason).toBe('No spoken words');
    const gone = applyBulk(store.videos, ['vid_sky', 'nope'], { type: 'captions_available', value: null }, 'admin', rules, NOW);
    expect(gone.succeeded).toEqual(['vid_sky']);
    expect(gone.failed).toEqual([{ id: 'nope', reason: 'That video no longer exists.' }]);
    expect(sky.captionsEnabled).toBeNull();
    expect(sky.captionsOffReason).toBeNull();
  });

  it('captions_available needs a reason for off and an admin', () => {
    const store = fresh();
    const noReason = applyBulk(store.videos, ['vid_sky'], { type: 'captions_available', value: false }, 'admin', rules, NOW);
    expect(noReason.failed[0]!.reason).toMatch(/reason/);
    const editor = applyBulk(store.videos, ['vid_sky'], { type: 'captions_available', value: true }, 'editor', rules, NOW);
    expect(editor.failed[0]!.reason).toBe('Only an Admin can change this.');
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
    applyBulk(
      store.videos,
      ['vid_sky'],
      { type: 'category', categoryId: 'cat_maths' },
      'editor',
      rules,
      NOW,
    );
    applyBulk(
      store.videos,
      ['vid_sky'],
      { type: 'category', categoryId: 'cat_maths' },
      'editor',
      rules,
      NOW,
    );
    expect(
      store.videos.find((v) => v.id === 'vid_sky')!.categoryIds.filter((c) => c === 'cat_maths'),
    ).toHaveLength(1);
    applyBulk(store.videos, ['vid_sky'], { type: 'unpublish' }, 'editor', rules, NOW);
    expect(store.videos.find((v) => v.id === 'vid_sky')!.publishState).toBe('unpublished');
  });

  it('refuses everything for a viewer', () => {
    const store = fresh();
    const result = applyBulk(
      store.videos,
      ['vid_sky'],
      { type: 'unpublish' },
      'viewer',
      rules,
      NOW,
    );
    expect(result.succeeded).toEqual([]);
    expect(result.failed[0]!.reason).toBe('You do not have permission for this.');
  });

  it('reports a missing video', () => {
    const result = applyBulk(fresh().videos, ['nope'], { type: 'unpublish' }, 'editor', rules, NOW);
    expect(result.failed).toEqual([{ id: 'nope', reason: 'That video no longer exists.' }]);
  });
});

describe('applyBulk remove_category (L3-04)', () => {
  const rules = { requireApprovedCaptions: true };

  it('remove_category removes only where present and reports the rest as skipped', () => {
    const store = fresh();
    const withIt = store.videos.find((v) => v.categoryIds.includes('cat_maths'))!;
    const without = store.videos.find((v) => !v.categoryIds.includes('cat_maths') && v.deletedAt === null)!;
    const result = applyBulk(
      store.videos,
      [withIt.id, without.id],
      { type: 'remove_category', categoryId: 'cat_maths' },
      'editor',
      rules,
      NOW,
    );
    expect(result.succeeded).toEqual([withIt.id]);
    expect(result.skipped).toEqual([{ id: without.id, reason: 'Not in that category.' }]);
    expect(withIt.categoryIds).not.toContain('cat_maths');
  });

  it('remove_category needs edit permission', () => {
    const result = applyBulk(fresh().videos, ['vid_sky'], { type: 'remove_category', categoryId: 'cat_maths' }, 'viewer', rules, NOW);
    expect(result.failed[0]!.reason).toBe('You do not have permission for this.');
  });

  it('publish reports Not ready with the first blocker per failed id', () => {
    const result = applyBulk(fresh().videos, ['vid_naira'], { type: 'publish' }, 'editor', rules, NOW);
    expect(result.failed[0]!.reason).toMatch(/^Not ready: .+ needs attention first\.$/);
  });
});

describe('applyBulk maturity', () => {
  const rules = { requireCaptions: false } as never;
  it('sets the rank on every selected video, or on none when one is missing', () => {
    const store = seedStore(Date.parse('2026-11-17T09:00:00Z'));
    const [a, b] = store.videos;
    const ok = applyBulk([a!, b!], [a!.id, b!.id], { type: 'maturity', value: 3 }, 'editor', rules, 0);
    expect(ok.succeeded).toEqual([a!.id, b!.id]);
    expect(a!.maturityRank).toBe(3);
    const none = applyBulk([a!, b!], [b!.id, 'ghost'], { type: 'maturity', value: 1 }, 'editor', rules, 0);
    expect(none.succeeded).toEqual([]);
    expect(b!.maturityRank).toBe(3);
  });

  it('refuses a rank outside 0 to 4', () => {
    const store = seedStore(Date.parse('2026-11-17T09:00:00Z'));
    const [a] = store.videos;
    const out = applyBulk([a!], [a!.id], { type: 'maturity', value: 7 }, 'editor', rules, 0);
    expect(out.succeeded).toEqual([]);
    expect(out.failed[0]!.reason).toMatch(/one of the five ratings/);
  });
});

describe('applyBulk suitability', () => {
  const rules = { requireCaptions: false } as never;
  it('changes every selected video, or none when one is missing', () => {
    const store = seedStore(Date.parse('2026-11-17T09:00:00Z'));
    const [a, b] = store.videos;
    const ok = applyBulk(
      [a!, b!],
      [a!.id, b!.id],
      { type: 'suitability', value: 'kids' },
      'editor',
      rules,
      0,
    );
    expect(ok.succeeded).toEqual([a!.id, b!.id]);
    expect(a!.suitability).toBe('kids');

    const before = b!.suitability;
    const none = applyBulk(
      [a!, b!],
      [b!.id, 'ghost'],
      { type: 'suitability', value: 'older' },
      'editor',
      rules,
      0,
    );
    expect(none.succeeded).toEqual([]);
    expect(none.failed.map((f) => f.id)).toEqual(['ghost']);
    expect(b!.suitability).toBe(before);
  });
});
