import { makeVideo } from '@ad/db/testing';
import { videos } from '@ad/db';
import type { Actor } from '@ad/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  categorize,
  createViewerTestDb,
  integrationEnabled,
  seedAccount,
  seedCategory,
  seedVideo,
  type ViewerTestDb,
} from '../testing';
import { listAdminVideosPage } from './videos';
import type { AdminContext } from './types';

describe.skipIf(!integrationEnabled())('admin video pages', () => {
  let t: ViewerTestDb;
  let ctx: AdminContext;
  let editor: Actor;
  let viewer: Actor;

  beforeAll(async () => {
    t = await createViewerTestDb();
    ctx = { db: t.app };
    editor = { accountId: (await seedAccount(t.setup, 'editor')).id, role: 'editor' };
    viewer = { accountId: (await seedAccount(t.setup, 'viewer')).id, role: 'viewer' };
  });
  afterAll(async () => {
    await t?.drop();
  });

  it('refuses a viewer', async () => {
    await expect(listAdminVideosPage(ctx, viewer)).rejects.toThrow();
  });

  it('lists past 5000 rows by following the cursor, with no repeats and the true total', async () => {
    const base = Date.parse('2026-01-01T00:00:00Z');
    const rows = Array.from({ length: 5050 }, (_, i) =>
      makeVideo({
        title: `Bulk ${String(i).padStart(5, '0')}`,
        status: 'uploaded',
        publishState: 'draft',
        updatedAt: new Date(base + i * 1000),
      }),
    );
    for (let i = 0; i < rows.length; i += 1000)
      await t.setup.insert(videos).values(rows.slice(i, i + 1000));

    const seen = new Set<string>();
    let cursor: string | undefined;
    let pages = 0;
    let total = 0;
    do {
      const page = await listAdminVideosPage(ctx, editor, { cursor, limit: 50 });
      total = page.total;
      for (const item of page.items) {
        expect(seen.has(item.id)).toBe(false);
        seen.add(item.id);
      }
      cursor = page.nextCursor ?? undefined;
      pages += 1;
    } while (cursor);
    expect(total).toBe(5050);
    expect(seen.size).toBe(5050);
    expect(pages).toBe(101);
    await t.setup.delete(videos);
  }, 120_000);

  it('orders by a sort and direction, ties broken by id, and walks back to the same pages', async () => {
    const same = new Date('2026-03-01T00:00:00Z');
    for (const title of ['Delta', 'Alpha', 'Charlie', 'Bravo', 'Echo'])
      await seedVideo(t.setup, { title, updatedAt: same });

    const titles = async (query: Parameters<typeof listAdminVideosPage>[2]) =>
      (await listAdminVideosPage(ctx, editor, query)).items.map((v) => v.title);
    expect(await titles({ sort: 'title', limit: 5 })).toEqual([
      'Alpha',
      'Bravo',
      'Charlie',
      'Delta',
      'Echo',
    ]);
    expect(await titles({ sort: 'title', dir: 'desc', limit: 2 })).toEqual(['Echo', 'Delta']);

    const one = await listAdminVideosPage(ctx, editor, { sort: 'title', limit: 2 });
    const two = await listAdminVideosPage(ctx, editor, {
      sort: 'title',
      limit: 2,
      cursor: one.nextCursor!,
    });
    expect(two.items.map((v) => v.title)).toEqual(['Charlie', 'Delta']);
    expect(two.prevCursor).not.toBeNull();
    const back = await listAdminVideosPage(ctx, editor, {
      sort: 'title',
      limit: 2,
      cursor: two.prevCursor!,
    });
    expect(back.items.map((v) => v.title)).toEqual(['Alpha', 'Bravo']);
    expect(back.prevCursor).toBeNull();
    expect(back.nextCursor).not.toBeNull();
    expect(one.prevCursor).toBeNull();
    const last = await listAdminVideosPage(ctx, editor, {
      sort: 'title',
      limit: 2,
      cursor: two.nextCursor!,
    });
    expect(last.items.map((v) => v.title)).toEqual(['Echo']);
    expect(last.nextCursor).toBeNull();
  });

  it('filters by search, category, suitability, captions and status the way the screens badge them', async () => {
    await t.setup.delete(videos);
    const cat = await seedCategory(t.setup, 'Maths');
    const plain = await seedVideo(t.setup, {
      title: 'Fractions 100%',
      tags: ['numbers'],
      suitability: 'kids',
      kidsSafe: true,
    });
    await categorize(t.setup, { videoId: plain.id }, cat.id);
    await seedVideo(t.setup, { title: 'Other', publishState: 'draft', description: null });
    await seedVideo(t.setup, { title: 'Encoding', status: 'encoding', publishState: 'draft' });
    await seedVideo(t.setup, { title: 'Gone', deletedAt: new Date() });

    const run = async (query: Parameters<typeof listAdminVideosPage>[2]) =>
      (await listAdminVideosPage(ctx, editor, query)).items.map((v) => v.title);
    expect(await run({ q: 'fractions' })).toEqual(['Fractions 100%']);
    expect(await run({ q: '100%' })).toEqual(['Fractions 100%']);
    expect(await run({ q: '%' })).toEqual(['Fractions 100%']);
    expect(await run({ q: 'NUMBERS' })).toEqual(['Fractions 100%']);
    expect(await run({ categoryId: cat.id })).toEqual(['Fractions 100%']);
    expect(await run({ categoryId: 'not-a-uuid' })).toEqual([]);
    expect(await run({ suitability: 'kids' })).toEqual(['Fractions 100%']);
    expect(await run({ status: 'published' })).toEqual(['Fractions 100%']);
    expect(await run({ status: 'processing' })).toEqual(['Encoding']);
    expect(await run({ status: 'draft' })).toEqual(['Other']);
    expect(await run({ captions: 'none', status: 'needs_captions' })).toEqual([]);
    const all = await listAdminVideosPage(ctx, editor, { limit: 50 });
    expect(all.total).toBe(3);
    const filtered = await listAdminVideosPage(ctx, editor, { status: 'published' });
    expect(filtered.total).toBe(1);
  });

  it('treats a damaged cursor as the first page and an empty result as total zero', async () => {
    const first = await listAdminVideosPage(ctx, editor, { cursor: '!!!', limit: 2 });
    expect(first.items.length).toBe(2);
    const none = await listAdminVideosPage(ctx, editor, { q: 'zzzz-no-match' });
    expect(none).toEqual({ items: [], total: 0, nextCursor: null, prevCursor: null });
  });
});
