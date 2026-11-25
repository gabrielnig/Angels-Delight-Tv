import { sql } from 'drizzle-orm';
import { type Actor } from '@ad/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createViewerTestDb, integrationEnabled, seedAccount, seedVideo, type ViewerTestDb } from '../testing';
import { queueAdminPreviewBackfill, recutAdminPreview, setAdminPreviewMode } from './preview-clip';
import { getAdminVideo } from './videos';
import type { AdminContext } from './types';

type Sent = { queue: string; payload: Record<string, unknown> };

describe.skipIf(!integrationEnabled())('admin hero preview clip', () => {
  let t: ViewerTestDb;
  let ctx: AdminContext;
  let editor: Actor;
  let viewer: Actor;
  let sent: Sent[];
  const enqueue = async (queue: string, payload: Record<string, unknown>) => void sent.push({ queue, payload });

  beforeAll(async () => {
    t = await createViewerTestDb();
    ctx = { db: t.app };
    editor = { accountId: (await seedAccount(t.setup, 'editor')).id, role: 'editor' };
    viewer = { accountId: (await seedAccount(t.setup)).id, role: 'viewer' };
  });
  afterAll(async () => {
    await t?.drop();
  });

  const video = (fields: Record<string, unknown> = {}) =>
    seedVideo(t.setup, { title: 'Clip test', durationMs: 90_000, ...fields } as never);
  const read = async (id: string) =>
    (
      await t.setup.execute(
        sql`select preview_mode, preview_state, preview_start_ms, preview_note from videos where id = ${id}`,
      )
    ).rows[0] as { preview_mode: string; preview_state: string; preview_start_ms: number | null; preview_note: string | null };
  const audits = async (id: string) =>
    (await t.setup.execute(sql`select action, metadata from audit_log where target_id = ${id} and action = 'video.preview_mode'`))
      .rows as Array<{ action: string; metadata: Record<string, unknown> }>;

  it('turning the clip off hides it, queues nothing and records before and after', async () => {
    sent = [];
    const v = await video();
    expect(await setAdminPreviewMode(ctx, editor, v.id, { mode: 'off' }, enqueue)).toEqual({ ok: true });
    expect(await read(v.id)).toMatchObject({ preview_mode: 'off' });
    expect(sent).toEqual([]);
    const [entry] = await audits(v.id);
    expect(JSON.stringify(entry!.metadata)).toMatch(/auto/);
    expect(JSON.stringify(entry!.metadata)).toMatch(/off/);
  });

  it('a picked segment checks the start, saves it and queues a recut', async () => {
    sent = [];
    const v = await video();
    expect(await setAdminPreviewMode(ctx, editor, v.id, { mode: 'picked', startMs: 12_350 }, enqueue)).toMatchObject({
      ok: false,
    });
    expect(await setAdminPreviewMode(ctx, editor, v.id, { mode: 'picked', startMs: 85_000 }, enqueue)).toEqual({
      ok: false,
      error: 'Pick a start between 0:00 and 1:10 so the clip has 20 seconds to play',
    });
    expect(await setAdminPreviewMode(ctx, editor, v.id, { mode: 'picked' }, enqueue)).toMatchObject({ ok: false });
    expect(sent).toEqual([]);
    expect(await setAdminPreviewMode(ctx, editor, v.id, { mode: 'picked', startMs: 12_300 }, enqueue)).toEqual({ ok: true });
    expect(await read(v.id)).toMatchObject({ preview_mode: 'picked', preview_state: 'queued', preview_start_ms: 12_300 });
    expect(sent).toEqual([{ queue: 'video.preview', payload: { videoId: v.id, mode: 'picked', startMs: 12_300 } }]);
  });

  it('going back to automatic clears the start and queues a recut', async () => {
    sent = [];
    const v = await video({ previewMode: 'picked', previewStartMs: 5000 });
    expect(await setAdminPreviewMode(ctx, editor, v.id, { mode: 'auto' }, enqueue)).toEqual({ ok: true });
    expect(await read(v.id)).toMatchObject({ preview_mode: 'auto', preview_state: 'queued', preview_start_ms: null });
    expect(sent).toEqual([{ queue: 'video.preview', payload: { videoId: v.id, mode: 'auto' } }]);
  });

  it('retry queues the clip again, even for a video that is not published', async () => {
    sent = [];
    const v = await video({ publishState: 'draft', previewState: 'failed', previewNote: 'The clip came out too large' });
    expect(await recutAdminPreview(ctx, editor, v.id, enqueue)).toEqual({ ok: true });
    expect(await read(v.id)).toMatchObject({ preview_state: 'queued', preview_note: null });
    expect(sent).toHaveLength(1);
  });

  it('retry refuses when the clip is off', async () => {
    const v = await video({ previewMode: 'off' });
    expect(await recutAdminPreview(ctx, editor, v.id, enqueue)).toEqual({
      ok: false,
      error: 'Turn the preview clip on first',
    });
  });

  it('a viewer cannot change or retry a clip', async () => {
    const v = await video();
    await expect(setAdminPreviewMode(ctx, viewer, v.id, { mode: 'off' }, enqueue)).rejects.toThrow();
    await expect(recutAdminPreview(ctx, viewer, v.id, enqueue)).rejects.toThrow();
  });

  it('says so when the video is gone', async () => {
    expect(await recutAdminPreview(ctx, editor, '0192f0a0-0000-7000-8000-0000000000ff', enqueue)).toMatchObject({
      ok: false,
    });
  });

  it('shows the clip state, mode, start and note on the admin video', async () => {
    const v = await video({ previewMode: 'picked', previewStartMs: 4200, previewState: 'failed', previewNote: 'The clip came out too large' });
    const found = await getAdminVideo(ctx, editor, v.id);
    expect(found?.preview).toEqual({ state: 'failed', mode: 'picked', startMs: 4200, note: 'The clip came out too large' });
  });

  describe('Generate previews for all videos', () => {
    let admin: Actor;
    beforeAll(async () => {
      admin = { accountId: (await seedAccount(t.setup, 'admin')).id, role: 'admin' };
    });
    const mine = (ids: string[]) => sent.filter((job) => ids.includes(String(job.payload.videoId)));
    const make = (fields: Record<string, unknown> = {}) =>
      video({ originalKey: 'originals/x/up', originalBytes: 1000, ...fields });
    const ready = { previewState: 'ready', previewKey: 'cap/x/preview/0-abcd1234.mp4', previewBytes: 500_000 };
    const run = (actor: Actor = admin) => queueAdminPreviewBackfill(ctx, actor, enqueue);

    it('queues published videos that have no clip, a failed or skipped one, and clips made before sound existed', async () => {
      sent = [];
      const none = await make();
      const failed = await make({ previewState: 'failed', previewNote: 'The clip came out too large' });
      const skipped = await make({ previewState: 'skipped', previewNote: 'The video looks too dark or plain for a clip' });
      const legacy = await make({ ...ready });
      const result = await run();
      expect(result).toMatchObject({ ok: true });
      const jobs = mine([none.id, failed.id, skipped.id, legacy.id]);
      expect(jobs.map((job) => job.queue)).toEqual(Array(4).fill('video.preview'));
      expect(jobs.map((job) => job.payload.mode).sort()).toEqual(['auto', 'auto', 'auto', 'auto']);
      for (const id of [none.id, failed.id, skipped.id, legacy.id]) {
        expect(await read(id)).toMatchObject({ preview_state: 'queued', preview_note: null });
      }
    });

    it('leaves out videos that are off, unpublished, deleted, without an original, current or already queued', async () => {
      sent = [];
      const off = await make({ previewMode: 'off' });
      const draft = await make({ publishState: 'draft' });
      const deleted = await make({ deletedAt: new Date() });
      const noOriginal = await make({ originalKey: null, originalBytes: null });
      const current = await make({ ...ready, durationMs: 90_000, previewLengthMs: 20_000, previewHasAudio: true });
      const whole = await make({ ...ready, durationMs: 14_000, previewLengthMs: 14_000, previewHasAudio: true });
      const queued = await make({ previewState: 'queued' });
      await run();
      expect(mine([off.id, draft.id, deleted.id, noOriginal.id, current.id, whole.id, queued.id])).toEqual([]);
    });

    it('is safe to press again: a second press queues nothing new and reports how many are current', async () => {
      await make();
      sent = [];
      const first = await run();
      expect(first).toMatchObject({ ok: true });
      const queuedFirst = sent.length;
      expect(queuedFirst).toBeGreaterThan(0);
      sent = [];
      const second = await run();
      expect(second).toMatchObject({ ok: true, queued: 0 });
      expect(sent).toEqual([]);
    });

    it('queues a clip again when its recorded length no longer matches the setting', async () => {
      sent = [];
      const old = await make({ ...ready, durationMs: 90_000, previewLengthMs: 6000, previewHasAudio: true });
      await run();
      expect(mine([old.id])).toHaveLength(1);
    });

    it('picks up a queued video that has been stuck for over an hour', async () => {
      sent = [];
      const stuck = await make({ previewState: 'queued', updatedAt: new Date(Date.now() - 2 * 3_600_000) });
      await run();
      expect(mine([stuck.id])).toHaveLength(1);
    });

    it('keeps a picked start for a video whose mode is picked', async () => {
      sent = [];
      const picked = await make({ previewMode: 'picked', previewStartMs: 12_300 });
      await run();
      expect(mine([picked.id])[0]?.payload).toEqual({ videoId: picked.id, mode: 'picked', startMs: 12_300 });
    });

    it('reports the numbers and records one audit entry', async () => {
      await make();
      sent = [];
      const result = await run();
      expect(result).toMatchObject({ ok: true, queued: expect.any(Number), current: expect.any(Number) });
      const { rows } = await t.setup.execute(
        sql`select metadata from audit_log where action = 'video.preview_backfill' and actor_account_id = ${admin.accountId}`,
      );
      expect(rows.length).toBeGreaterThan(0);
    });

    it('is for admins: an editor and a viewer are refused', async () => {
      await expect(run(editor)).rejects.toThrow();
      await expect(run(viewer)).rejects.toThrow();
    });
  });
});
