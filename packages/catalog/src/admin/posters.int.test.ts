import { eq } from 'drizzle-orm';
import { assets } from '@ad/db';
import type { Actor } from '@ad/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createViewerTestDb,
  integrationEnabled,
  seedAccount,
  seedVideo,
  type ViewerTestDb,
} from '../testing';
import {
  createPosterUpload,
  getPosterAssetStatus,
  listPosterAssets,
  posterUploadKey,
} from './posters';
import type { AdminContext } from './types';

describe.skipIf(!integrationEnabled())('admin poster assets', () => {
  let t: ViewerTestDb;
  let ctx: AdminContext;
  let editor: Actor;
  let viewer: Actor;
  let videoId: string;

  beforeAll(async () => {
    t = await createViewerTestDb();
    ctx = { db: t.app };
    editor = { accountId: (await seedAccount(t.setup, 'editor')).id, role: 'editor' };
    viewer = { accountId: (await seedAccount(t.setup, 'viewer')).id, role: 'viewer' };
    videoId = (await seedVideo(t.setup, { publishState: 'draft' })).id;
  });
  afterAll(async () => {
    await t?.drop();
  });

  it('records an upload as a processing asset, stores the source first and queues image.process', async () => {
    const calls: string[] = [];
    const out = await createPosterUpload(ctx, editor, videoId, {
      mime: 'image/png',
      bytes: 1234,
      store: async (key) => void calls.push(`store:${key}`),
      enqueue: async (queue) => void calls.push(`enqueue:${queue}`),
    });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(calls).toEqual([`store:${posterUploadKey(videoId, out.assetId)}`, 'enqueue:image.process']);
    const [row] = await t.setup.select().from(assets).where(eq(assets.id, out.assetId));
    expect(row).toMatchObject({
      status: 'processing',
      purpose: 'thumbnail',
      mime: 'image/png',
      bytes: 1234,
      createdBy: editor.accountId,
    });
    expect(row!.rawKey).toBe(posterUploadKey(videoId, out.assetId));
  });

  it('refuses viewers and unknown videos', async () => {
    const input = { mime: 'image/png', bytes: 1, store: async () => {}, enqueue: async () => {} };
    await expect(createPosterUpload(ctx, viewer, videoId, input)).rejects.toThrow();
    await expect(
      createPosterUpload(ctx, editor, '0192f0a0-0000-7000-8000-0000000000aa', input),
    ).rejects.toThrow(/not found/i);
  });

  it('lists frames and uploads for one video with their state and preview', async () => {
    const other = (await seedVideo(t.setup, { publishState: 'draft' })).id;
    const mine = await t.setup
      .insert(assets)
      .values([
        {
          purpose: 'thumbnail',
          status: 'ready',
          rawKey: `candidates/${videoId}/2`,
          mime: 'image/webp',
          variants: [
            { width: 640, height: 360, key: 'img/f/640-aa.webp', bytes: 1, format: 'webp' },
            { width: 320, height: 180, key: 'img/f/320-bb.webp', bytes: 1, format: 'webp' },
          ],
        },
        { purpose: 'thumbnail', status: 'processing', rawKey: `candidates/${videoId}/1`, mime: 'image/webp' },
        { purpose: 'thumbnail', status: 'ready', rawKey: `candidates/${other}/1`, mime: 'image/webp' },
      ])
      .returning({ id: assets.id });
    expect(mine).toHaveLength(3);
    const list = await listPosterAssets(ctx, editor, videoId, 'https://m.test');
    const frames = list.filter((a) => a.source === 'frame');
    expect(frames.map((f) => f.label)).toEqual(['Frame 1', 'Frame 2']);
    expect(frames[1]).toMatchObject({ status: 'ready', url: 'https://m.test/img/f/320-bb.webp' });
    expect(frames[0]).toMatchObject({ status: 'processing', url: null });
    expect(list.some((a) => a.source === 'upload')).toBe(true);
  });

  it('reports the status of one asset', async () => {
    const [{ id }] = await t.setup
      .insert(assets)
      .values({ purpose: 'thumbnail', status: 'failed', rawKey: `uploads/${videoId}/x`, mime: 'image/png' })
      .returning({ id: assets.id });
    expect(await getPosterAssetStatus(ctx, editor, id!)).toEqual({ status: 'failed' });
    await expect(getPosterAssetStatus(ctx, viewer, id!)).rejects.toThrow();
  });
});
