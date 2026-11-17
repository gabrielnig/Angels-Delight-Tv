import { eq } from 'drizzle-orm';
import { jobs, videos } from '@ad/db';
import type { Actor } from '@ad/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createViewerTestDb,
  integrationEnabled,
  seedAccount,
  seedVideo,
  type ViewerTestDb,
} from '../testing';
import type { AdminContext } from './types';
import { listAdminVideos, requestPurgeAdminVideo, retryAdminVideo } from './videos';

describe.skipIf(!integrationEnabled())('admin retry and purge requests', () => {
  let t: ViewerTestDb;
  let ctx: AdminContext;
  let editor: Actor;
  let admin: Actor;
  const sent: Array<{ queue: string; payload: object; createdBy?: string }> = [];
  const enqueue = async (queue: string, payload: object, options?: { createdBy?: string }) => {
    sent.push({ queue, payload, createdBy: options?.createdBy });
  };

  beforeAll(async () => {
    t = await createViewerTestDb();
    ctx = { db: t.app };
    editor = { accountId: (await seedAccount(t.setup, 'editor')).id, role: 'editor' };
    admin = { accountId: (await seedAccount(t.setup, 'admin')).id, role: 'admin' };
  });
  afterAll(async () => {
    await t?.drop();
  });

  it('retries a failed video from the right stage and clears the failure', async () => {
    const unprobed = await seedVideo(t.setup, {
      status: 'failed',
      publishState: 'draft',
      durationMs: null,
      originalKey: 'originals/x/source.mp4',
      failureCode: 'damaged_file',
      failureMessage: 'The file is damaged.',
    });
    const probed = await seedVideo(t.setup, {
      status: 'failed',
      publishState: 'draft',
      originalKey: 'originals/y/source.mp4',
    });

    expect(await retryAdminVideo(ctx, editor, unprobed.id, enqueue)).toEqual({ ok: true });
    expect(await retryAdminVideo(ctx, editor, probed.id, enqueue)).toEqual({ ok: true });
    expect(sent.map((s) => s.queue)).toEqual(['video.probe', 'video.encode']);
    expect(sent[0]).toMatchObject({
      payload: { videoId: unprobed.id },
      createdBy: editor.accountId,
    });
    const [row] = await t.setup.select().from(videos).where(eq(videos.id, unprobed.id));
    expect(row).toMatchObject({ status: 'uploaded', failureCode: null, failureMessage: null });
  });

  it('refuses to retry a video that has not failed or lost its source', async () => {
    const fine = await seedVideo(t.setup);
    expect(await retryAdminVideo(ctx, editor, fine.id, enqueue)).toEqual({
      ok: false,
      error: 'Only failed videos can be retried.',
    });
    const noSource = await seedVideo(t.setup, {
      status: 'failed',
      publishState: 'draft',
      originalKey: null,
    });
    expect(await retryAdminVideo(ctx, editor, noSource.id, enqueue)).toEqual({
      ok: false,
      error: 'The source file was removed. Replace the file instead.',
    });
  });

  it('purge is admin only, needs the video to be in Trash, and queues the purge job', async () => {
    const live = await seedVideo(t.setup);
    const trashed = await seedVideo(t.setup, { deletedAt: new Date() });
    const before = sent.length;

    await expect(requestPurgeAdminVideo(ctx, editor, trashed.id, enqueue)).rejects.toThrow();
    expect(await requestPurgeAdminVideo(ctx, admin, live.id, enqueue)).toEqual({
      ok: false,
      error: 'That video is not in Trash.',
    });
    expect(sent).toHaveLength(before);

    expect(await requestPurgeAdminVideo(ctx, admin, trashed.id, enqueue)).toEqual({ ok: true });
    expect(sent.at(-1)).toMatchObject({ queue: 'video.purge', payload: { videoId: trashed.id } });
  });

  it('hides a video from Trash while its purge job is open', async () => {
    const trashed = await seedVideo(t.setup, { deletedAt: new Date() });
    expect((await listAdminVideos(ctx, admin, { trashed: true })).map((v) => v.id)).toContain(
      trashed.id,
    );
    await t.setup
      .insert(jobs)
      .values({ queue: 'video.purge', videoId: trashed.id, status: 'queued' });
    expect((await listAdminVideos(ctx, admin, { trashed: true })).map((v) => v.id)).not.toContain(
      trashed.id,
    );
  });
});
