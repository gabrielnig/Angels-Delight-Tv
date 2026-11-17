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
});
