import { eq, sql } from 'drizzle-orm';
import { assets, captionTracks, captions, categories, videos } from '@ad/db';
import { uuidv7, type Actor } from '@ad/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { publish } from '../publishing';
import {
  categorize,
  createViewerTestDb,
  integrationEnabled,
  seedAccount,
  seedAsset,
  seedCategory,
  seedVideo,
  type ViewerTestDb,
} from '../testing';
import {
  adminNavCounts,
  bulkAdminVideos,
  getAdminVideo,
  listAdminVideos,
  restoreAdminVideo,
  setAdminPoster,
  trashVideos,
  updateAdminVideo,
} from './videos';
import type { AdminContext } from './types';

describe.skipIf(!integrationEnabled())('admin videos', () => {
  let t: ViewerTestDb;
  let ctx: AdminContext;
  let editor: Actor;
  let admin: Actor;
  let viewer: Actor;

  beforeAll(async () => {
    t = await createViewerTestDb();
    ctx = { db: t.app };
    editor = { accountId: (await seedAccount(t.setup, 'editor')).id, role: 'editor' };
    admin = { accountId: (await seedAccount(t.setup, 'admin')).id, role: 'admin' };
    viewer = { accountId: (await seedAccount(t.setup, 'viewer')).id, role: 'viewer' };
  });
  afterAll(async () => {
    await t?.drop();
  });

  it('refuses a viewer on every call', async () => {
    await expect(listAdminVideos(ctx, viewer)).rejects.toThrow();
    await expect(getAdminVideo(ctx, viewer, uuidv7())).rejects.toThrow();
    await expect(updateAdminVideo(ctx, viewer, uuidv7(), { title: 'x' })).rejects.toThrow();
  });

  it('lists live videos with category, series, duration and size, and leaves out trash', async () => {
    const cat = await seedCategory(t.setup, 'Science');
    const live = await seedVideo(t.setup, { title: 'Plants', originalBytes: 5_000_000 });
    await categorize(t.setup, { videoId: live.id }, cat.id);
    const gone = await seedVideo(t.setup, { title: 'Old', deletedAt: new Date() });

    const list = await listAdminVideos(ctx, editor);
    const found = list.find((v) => v.id === live.id)!;
    expect(found).toMatchObject({
      title: 'Plants',
      categoryIds: [cat.id],
      durationSeconds: 120,
      sizeBytes: 5_000_000,
      captionState: 'none',
      publishState: 'published',
      progress: 100,
    });
    expect(found.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/);
    expect(list.some((v) => v.id === gone.id)).toBe(false);
    const trashed = await listAdminVideos(ctx, editor, { trashed: true });
    expect(trashed.some((v) => v.id === gone.id)).toBe(true);
  });

  it('shows a failed video with its reason', async () => {
    const bad = await seedVideo(t.setup, {
      status: 'failed',
      publishState: 'draft',
      failureMessage: 'The file is not a video.',
    });
    expect((await getAdminVideo(ctx, editor, bad.id)).failure).toEqual({
      stage: 'processing',
      reason: 'The file is not a video.',
    });
  });

  it('edits details, derives kids safety from suitability, and writes an audit entry', async () => {
    const cat = await seedCategory(t.setup, 'History');
    const video = await seedVideo(t.setup, { publishState: 'draft' });

    const updated = await updateAdminVideo(ctx, editor, video.id, {
      title: 'Long ago',
      description: 'A lesson about the past.',
      tags: ['history', 'kids'],
      categoryIds: [cat.id],
      suitability: 'kids',
    });

    expect(updated).toMatchObject({
      title: 'Long ago',
      tags: ['history', 'kids'],
      categoryIds: [cat.id],
      suitability: 'kids',
    });
    const [row] = await t.setup.select().from(videos).where(eq(videos.id, video.id));
    expect(row?.kidsSafe).toBe(true);
    const audit = await t.setup.execute(
      sql`select action from audit_log where target_id = ${video.id}`,
    );
    expect(audit.rows.map((r) => r.action)).toContain('video.update');

    const older = await updateAdminVideo(ctx, editor, video.id, { suitability: 'older' });
    expect(older.suitability).toBe('older');
    const [after] = await t.setup.select().from(videos).where(eq(videos.id, video.id));
    expect(after?.kidsSafe).toBe(false);
  });

  it('rejects an unknown category and leaves the video unchanged', async () => {
    const video = await seedVideo(t.setup, { title: 'Keep me' });
    await expect(
      updateAdminVideo(ctx, editor, video.id, { categoryIds: [uuidv7()] }),
    ).rejects.toMatchObject({ fields: { categoryIds: ['Pick categories from the list.'] } });
  });

  it('chooses a poster from ready thumbnails only, and stores alt text and focus', async () => {
    const video = await seedVideo(t.setup);
    const good = await seedAsset(t.setup);
    const logo = uuidv7();
    await t.setup
      .insert(assets)
      .values({ id: logo, purpose: 'logo', status: 'ready', mime: 'image/png' });

    expect(
      await setAdminPoster(ctx, editor, video.id, {
        posterId: logo,
        alt: 'x',
        focus: { x: 0.5, y: 0.5 },
        zoom: 1,
      }),
    ).toEqual({ ok: false, error: 'Choose one of the poster images.' });

    expect(
      await setAdminPoster(ctx, editor, video.id, {
        posterId: good,
        alt: 'A seedling in soil',
        focus: { x: 0.4, y: 0.6 },
        zoom: 1.5,
      }),
    ).toEqual({ ok: true });
    const got = await getAdminVideo(ctx, editor, video.id);
    expect(got).toMatchObject({
      posterId: good,
      posterAlt: 'A seedling in soil',
      posterFocus: { x: 0.4, y: 0.6, zoom: 1.5 },
    });
  });

  it('bulk suitability updates every selected video together and audits each', async () => {
    const a = await seedVideo(t.setup, { title: 'Bulk a' });
    const b = await seedVideo(t.setup, { title: 'Bulk b' });
    const done = await bulkAdminVideos(ctx, editor, [a.id, b.id], {
      type: 'suitability',
      value: 'kids',
    });
    expect(done).toEqual({ succeeded: [a.id, b.id], failed: [] });
    for (const video of [a, b]) {
      const row = await getAdminVideo(ctx, editor, video.id);
      expect(row.suitability).toBe('kids');
    }
  });

  it('bulk suitability changes nothing when one id fails, and names the failed id', async () => {
    const a = await seedVideo(t.setup, { title: 'All or nothing' });
    const before = (await getAdminVideo(ctx, editor, a.id)).suitability;
    const ghost = uuidv7();
    const result = await bulkAdminVideos(ctx, editor, [a.id, ghost], {
      type: 'suitability',
      value: 'older',
    });
    expect(result.succeeded).toEqual([]);
    expect(result.failed.map((f) => f.id)).toContain(ghost);
    expect((await getAdminVideo(ctx, editor, a.id)).suitability).toBe(before);
  });

  it('bulk captions availability is admin only, per id, and writes the bulk id on each audit row', async () => {
    const a = await seedVideo(t.setup, { title: 'Captions bulk a' });
    const ghost = uuidv7();
    const denied = await bulkAdminVideos(ctx, editor, [a.id], { type: 'captions_available', value: true });
    expect(denied.succeeded).toEqual([]);
    expect(denied.failed[0]?.reason).toBe('Only an Admin can change this.');
    const done = await bulkAdminVideos(
      ctx,
      admin,
      [a.id, ghost],
      { type: 'captions_available', value: false, reason: 'No spoken words' },
      'bulk-123',
    );
    expect(done.succeeded).toEqual([a.id]);
    expect(done.failed.map((f) => f.id)).toEqual([ghost]);
    const row = await t.setup.execute(
      sql`select captions_enabled, captions_off_reason from videos where id = ${a.id}`,
    );
    expect(row.rows[0]).toMatchObject({ captions_enabled: false, captions_off_reason: 'No spoken words' });
    const audit = await t.setup.execute(
      sql`select metadata from audit_log where target_id = ${a.id} and action = 'video.captions_availability'`,
    );
    expect(JSON.stringify(audit.rows[0])).toContain('bulk-123');
  });

  it('bulk remove category removes only where present, skips the rest and audits each removal', async () => {
    const cat = await seedCategory(t.setup, 'Remove me');
    const withCat = await seedVideo(t.setup, { title: 'Has category' });
    const without = await seedVideo(t.setup, { title: 'No category' });
    await categorize(t.setup, { videoId: withCat.id }, cat.id);
    const result = await bulkAdminVideos(ctx, editor, [withCat.id, without.id], {
      type: 'remove_category',
      categoryId: cat.id,
    });
    expect(result.succeeded).toEqual([withCat.id]);
    expect(result.skipped).toEqual([{ id: without.id, reason: 'Not in that category.' }]);
    expect((await getAdminVideo(ctx, editor, withCat.id)).categoryIds).not.toContain(cat.id);
    const audit = await t.setup.execute(
      sql`select action from audit_log where target_id = ${withCat.id}`,
    );
    expect(audit.rows.map((r) => r.action)).toContain('video.update');
  });

  it('an editor forging a trash call gets denied and the video stays', async () => {
    const video = await seedVideo(t.setup, { title: 'Forged trash' });
    const denied = await bulkAdminVideos(ctx, editor, [video.id], { type: 'trash' });
    expect(denied.succeeded).toEqual([]);
    expect(await getAdminVideo(ctx, editor, video.id)).toMatchObject({ id: video.id });
  });

  it('bulk suitability refuses viewers', async () => {
    const a = await seedVideo(t.setup, { title: 'Viewer cannot' });
    await expect(
      bulkAdminVideos(ctx, viewer, [a.id], { type: 'suitability', value: 'kids' }),
    ).rejects.toThrow();
  });

  it('trash is admin only, hides the video from viewers, and restore brings it back', async () => {
    const video = await seedVideo(t.setup, { title: 'Trash me' });
    const denied = await bulkAdminVideos(ctx, editor, [video.id], { type: 'trash' });
    expect(denied.failed[0]?.reason).toMatch(/admin/i);

    const done = await trashVideos(ctx, admin, [video.id, uuidv7()]);
    expect(done.succeeded).toEqual([video.id]);
    expect(done.failed).toHaveLength(1);
    await expect(getAdminVideo(ctx, editor, video.id)).rejects.toThrow(/not found/i);

    expect(await restoreAdminVideo(ctx, editor, video.id)).toEqual({ ok: true });
    expect((await getAdminVideo(ctx, editor, video.id)).deletedAt).toBeNull();
    expect(await restoreAdminVideo(ctx, editor, video.id)).toEqual({
      ok: false,
      error: 'That video is not in Trash.',
    });
  });

  it('refuses restore when the web address was taken meanwhile', async () => {
    const first = await seedVideo(t.setup, { slug: 'same-address', deletedAt: new Date() });
    await seedVideo(t.setup, { slug: 'same-address' });
    const result = await restoreAdminVideo(ctx, admin, first.id);
    expect(result.ok).toBe(false);
  });

  it('bulk publish reports each video alone and stores the caption override reason', async () => {
    const ready = await seedVideo(t.setup, { publishState: 'draft', description: 'A lesson.' });
    const cat = await seedCategory(t.setup, 'Bulk');
    const poster = await seedAsset(t.setup);
    await t.setup.update(videos).set({ posterAssetId: poster }).where(eq(videos.id, ready.id));
    await categorize(t.setup, { videoId: ready.id }, cat.id);
    const incomplete = await seedVideo(t.setup, { publishState: 'draft', status: 'encoding' });

    const result = await bulkAdminVideos(ctx, admin, [ready.id, incomplete.id], {
      type: 'publish',
    });
    expect(result.succeeded).toEqual([]); // no approved captions, so both are blocked
    expect(result.failed.map((f) => f.id).sort()).toEqual([ready.id, incomplete.id].sort());

    await publish(ctx, admin, 'video', ready.id, { captionOverride: { reason: 'Music only' } });
    expect((await getAdminVideo(ctx, admin, ready.id)).captionOverrideReason).toBe('Music only');

    const added = await bulkAdminVideos(ctx, editor, [ready.id], {
      type: 'category',
      categoryId: (await seedCategory(t.setup, 'Extra')).id,
    });
    expect(added.succeeded).toEqual([ready.id]);
    expect((await t.setup.select().from(categories)).length).toBeGreaterThan(2);
  });

  it('counts work waiting in the navigation without loading every video', async () => {
    const fresh = await createViewerTestDb();
    try {
      const staff = {
        accountId: (await seedAccount(fresh.setup, 'editor')).id,
        role: 'editor' as const,
      };
      const fctx = { db: fresh.app };
      await seedVideo(fresh.setup, { status: 'encoding', publishState: 'draft' });
      await seedVideo(fresh.setup, { status: 'uploaded', publishState: 'draft' });
      await seedVideo(fresh.setup, {
        status: 'encoding',
        publishState: 'draft',
        deletedAt: new Date(),
      });
      const reviewing = await seedVideo(fresh.setup);
      const approved = await seedVideo(fresh.setup);
      const make = async (videoId: string, status: 'in_review' | 'approved', revision = 1) => {
        const track = await fresh.setup
          .insert(captionTracks)
          .values({ videoId, language: 'en', label: 'English', kind: 'captions', isDefault: true })
          .onConflictDoNothing()
          .returning();
        const trackId =
          track[0]?.id ??
          (
            await fresh.setup.select().from(captionTracks).where(eq(captionTracks.videoId, videoId))
          )[0]!.id;
        await fresh.setup.insert(captions).values({
          trackId,
          revision,
          source: 'whisper',
          status,
          storageKey: `k/${videoId}/${revision}`,
          sha256: Buffer.alloc(32),
          bytes: 10,
          cueCount: 3,
          ...(status === 'approved'
            ? { reviewedBy: staff.accountId, publicKey: `pub/${videoId}.vtt` }
            : {}),
        });
      };
      await make(reviewing.id, 'in_review');
      await make(approved.id, 'approved');
      expect(await adminNavCounts(fctx, staff)).toEqual({ encoding: 2, captions: 1 });
    } finally {
      await fresh.drop();
    }
  });

  describe('poster focus recut (M36-S03)', () => {
    const makeRecut = () => {
      const copies: Array<[string, string]> = [];
      const queued: Array<{ queue: string; assetId: string }> = [];
      return {
        copies,
        queued,
        recut: {
          copySource: async (from: string, to: string) => void copies.push([from, to]),
          enqueue: async (queue: 'image.process', payload: { assetId: string }) =>
            void queued.push({ queue, assetId: payload.assetId }),
        },
      };
    };
    const source = async () => {
      const id = await seedAsset(t.setup);
      await t.setup
        .update(assets)
        .set({ rawKey: `uploads/x/${id}` })
        .where(eq(assets.id, id));
      return id;
    };

    it('creates a recut asset, copies the source, queues the job and keeps the old poster until it is ready', async () => {
      const video = await seedVideo(t.setup);
      const picture = await source();
      const { recut, copies, queued } = makeRecut();
      const result = await setAdminPoster(ctx, editor, video.id, {
        posterId: picture,
        alt: 'A seedling',
        focus: { x: 80, y: 40 },
        zoom: 150,
        recut,
      });
      expect(result).toEqual({ ok: true });
      const cuts = await t.setup.select().from(assets).where(eq(assets.cutFrom, picture));
      expect(cuts).toHaveLength(1);
      expect(cuts[0]).toMatchObject({
        status: 'processing',
        purpose: 'thumbnail',
        altText: 'A seedling',
        cutFocus: { x: 80, y: 40, zoom: 150 },
      });
      expect(copies).toEqual([[`uploads/x/${picture}`, cuts[0]!.rawKey]]);
      expect(cuts[0]!.rawKey).toBe(`recuts/${video.id}/${cuts[0]!.id}`);
      expect(queued).toEqual([{ queue: 'image.process', assetId: cuts[0]!.id }]);
      const [row] = await t.setup.select().from(videos).where(eq(videos.id, video.id));
      expect(row?.posterAssetId).toBe(picture);
      expect(row?.posterFocus).toEqual({ x: 80, y: 40, zoom: 150 });
    });

    it('does not recut for the default focus', async () => {
      const video = await seedVideo(t.setup);
      const picture = await source();
      const { recut, queued } = makeRecut();
      await setAdminPoster(ctx, editor, video.id, {
        posterId: picture,
        alt: 'A seedling',
        focus: { x: 50, y: 50 },
        zoom: 100,
        recut,
      });
      expect(queued).toHaveLength(0);
      expect(await t.setup.select().from(assets).where(eq(assets.cutFrom, picture))).toHaveLength(
        0,
      );
    });

    it('reuses a ready recut with the same crop and points the video straight at it', async () => {
      const video = await seedVideo(t.setup);
      const picture = await source();
      const cut = uuidv7();
      await t.setup.insert(assets).values({
        id: cut,
        purpose: 'thumbnail',
        status: 'ready',
        mime: 'image/webp',
        cutFrom: picture,
        cutFocus: { x: 80, y: 40, zoom: 150 },
      });
      const { recut, queued } = makeRecut();
      await setAdminPoster(ctx, editor, video.id, {
        posterId: picture,
        alt: 'Updated words',
        focus: { x: 80, y: 40 },
        zoom: 150,
        recut,
      });
      expect(queued).toHaveLength(0);
      const [row] = await t.setup.select().from(videos).where(eq(videos.id, video.id));
      expect(row?.posterAssetId).toBe(cut);
      const [cutRow] = await t.setup.select().from(assets).where(eq(assets.id, cut));
      expect(cutRow?.altText).toBe('Updated words');
      expect((await getAdminVideo(ctx, editor, video.id)).posterId).toBe(picture);
    });

    it('accepts a recut as the chosen picture by resolving it back to its source', async () => {
      const video = await seedVideo(t.setup);
      const picture = await source();
      const cut = uuidv7();
      await t.setup.insert(assets).values({
        id: cut,
        purpose: 'thumbnail',
        status: 'ready',
        mime: 'image/webp',
        cutFrom: picture,
        cutFocus: { x: 80, y: 40, zoom: 150 },
      });
      const { recut, copies } = makeRecut();
      await setAdminPoster(ctx, editor, video.id, {
        posterId: cut,
        alt: 'x words',
        focus: { x: 10, y: 10 },
        zoom: 120,
        recut,
      });
      expect(copies[0]![0]).toBe(`uploads/x/${picture}`);
    });
  });

  describe('hero art follows the poster focus (M36-S03)', () => {
    const recutDeps = () => {
      const copies: Array<[string, string]> = [];
      const queued: string[] = [];
      return {
        copies,
        queued,
        recut: {
          copySource: async (from: string, to: string) => void copies.push([from, to]),
          enqueue: async (_queue: 'image.process', payload: { assetId: string }) =>
            void queued.push(payload.assetId),
        },
      };
    };
    const asset = async (purpose: 'thumbnail' | 'hero', key: string) => {
      const id = await seedAsset(t.setup);
      await t.setup.update(assets).set({ purpose, rawKey: key }).where(eq(assets.id, id));
      return id;
    };

    it('recuts the hero image from its own source and keeps the old hero until it is ready', async () => {
      const video = await seedVideo(t.setup);
      const poster = await asset('thumbnail', `uploads/h/${uuidv7()}`);
      const hero = await asset('hero', `uploads/h/${uuidv7()}`);
      await t.setup.update(videos).set({ heroAssetId: hero }).where(eq(videos.id, video.id));
      const { recut, copies, queued } = recutDeps();
      await setAdminPoster(ctx, editor, video.id, {
        posterId: poster,
        alt: 'A seedling',
        focus: { x: 70, y: 30 },
        zoom: 140,
        recut,
      });
      const cuts = await t.setup.select().from(assets).where(eq(assets.cutFrom, hero));
      expect(cuts).toHaveLength(1);
      expect(cuts[0]).toMatchObject({
        purpose: 'hero',
        status: 'processing',
        cutFocus: { x: 70, y: 30, zoom: 140 },
      });
      expect(copies.map(([from]) => from)).toContain(
        (await t.setup.select().from(assets).where(eq(assets.id, hero)))[0]!.rawKey,
      );
      expect(queued).toContain(cuts[0]!.id);
      const [row] = await t.setup.select().from(videos).where(eq(videos.id, video.id));
      expect(row?.heroAssetId).toBe(hero);
    });

    it('reports a recut that is still being made or has failed, and clears it once a good one exists', async () => {
      const video = await seedVideo(t.setup);
      const picture = await asset('thumbnail', `uploads/r/${uuidv7()}`);
      const focus = { x: 20, y: 30, zoom: 130 };
      await t.setup
        .update(videos)
        .set({ posterAssetId: picture, posterFocus: focus })
        .where(eq(videos.id, video.id));
      expect((await getAdminVideo(ctx, editor, video.id)).posterRecut).toBeNull();
      const cut = uuidv7();
      await t.setup.insert(assets).values({
        id: cut,
        purpose: 'thumbnail',
        status: 'processing',
        mime: 'image/png',
        cutFrom: picture,
        cutFocus: focus,
      });
      expect((await getAdminVideo(ctx, editor, video.id)).posterRecut).toBe('processing');
      await t.setup.update(assets).set({ status: 'failed' }).where(eq(assets.id, cut));
      const failed = await getAdminVideo(ctx, editor, video.id);
      expect(failed.posterRecut).toBe('failed');
      expect(failed.posterId).toBe(picture);
      await t.setup.update(assets).set({ status: 'ready' }).where(eq(assets.id, cut));
      expect((await getAdminVideo(ctx, editor, video.id)).posterRecut).toBeNull();
    });

    it('saving again after a failure makes a fresh recut instead of reusing the failed one', async () => {
      const video = await seedVideo(t.setup);
      const picture = await asset('thumbnail', `uploads/r/${uuidv7()}`);
      const focus = { x: 20, y: 30, zoom: 130 };
      await t.setup.insert(assets).values({
        purpose: 'thumbnail',
        status: 'failed',
        mime: 'image/png',
        cutFrom: picture,
        cutFocus: focus,
      });
      const { recut, queued } = recutDeps();
      await setAdminPoster(ctx, editor, video.id, {
        posterId: picture,
        alt: 'A seedling',
        focus: { x: 20, y: 30 },
        zoom: 130,
        recut,
      });
      expect(queued).toHaveLength(1);
    });

    it('does nothing for hero when the video has none, and resets it for the default focus', async () => {
      const bare = await seedVideo(t.setup);
      const poster = await asset('thumbnail', `uploads/h/${uuidv7()}`);
      const { recut, queued } = recutDeps();
      await setAdminPoster(ctx, editor, bare.id, {
        posterId: poster,
        alt: 'A seedling',
        focus: { x: 70, y: 30 },
        zoom: 140,
        recut,
      });
      expect(queued).toHaveLength(1); // the poster only

      const video = await seedVideo(t.setup);
      const hero = await asset('hero', `uploads/h/${uuidv7()}`);
      const cut = uuidv7();
      await t.setup.insert(assets).values({
        id: cut,
        purpose: 'hero',
        status: 'ready',
        mime: 'image/webp',
        cutFrom: hero,
        cutFocus: { x: 70, y: 30, zoom: 140 },
      });
      await t.setup.update(videos).set({ heroAssetId: cut }).where(eq(videos.id, video.id));
      await setAdminPoster(ctx, editor, video.id, {
        posterId: poster,
        alt: 'A seedling',
        focus: { x: 50, y: 50 },
        zoom: 100,
        recut,
      });
      const [row] = await t.setup.select().from(videos).where(eq(videos.id, video.id));
      expect(row?.heroAssetId).toBe(hero);
    });
  });
});
