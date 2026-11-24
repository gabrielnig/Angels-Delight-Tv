import { schema } from '@ad/db';
import { createTestDatabase, integrationEnabled, makeVideo, type TestDatabase } from '@ad/db/testing';
import { Conflict, NotFound } from '@ad/shared';
import { LocalStorage } from '@ad/storage';
import { eq } from 'drizzle-orm';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FailedEncodeService } from './failed';

const secret = new Uint8Array(32).fill(6);

describe.skipIf(!integrationEnabled())('FailedEncodeService against Postgres', () => {
  let t: TestDatabase;
  let root: string;
  let originals: LocalStorage;
  let media: LocalStorage;
  let service: FailedEncodeService;

  async function failed(over: Record<string, unknown> = {}) {
    const video = makeVideo({
      status: 'failed',
      durationMs: 9000,
      failureCode: 'encode_failed',
      failureMessage: 'The video could not be converted. Try exporting it again.',
      originalKey: 'x',
      originalBytes: 5,
      ...over,
    });
    video.originalKey = `originals/${video.id}/s1`;
    await t.db.insert(schema.videos).values(video);
    await originals.put(video.originalKey, new Uint8Array(5));
    await originals.put(`templates/${video.id}/720.m3u8`, new Uint8Array(10));
    await media.put(`v/${video.mediaPrefix}/720/seg_00000.ts`, new Uint8Array(100));
    await media.put(`v/${video.mediaPrefix}/720/seg_00001.ts`, new Uint8Array(200));
    await media.put(`cap/${video.mediaPrefix}/en.vtt`, new Uint8Array(7));
    await media.put(`cap/${video.mediaPrefix}/sprites/map-aa.vtt`, new Uint8Array(3));
    await t.db.insert(schema.renditions).values({
      videoId: video.id,
      height: 720,
      width: 1280,
      videoKbps: 2000,
      audioKbps: 96,
      status: 'failed',
    });
    return video;
  }

  beforeAll(async () => {
    t = await createTestDatabase();
    root = await mkdtemp(join(tmpdir(), 'ad-failed-'));
    originals = new LocalStorage({ root, bucket: 'originals', signingSecret: secret });
    media = new LocalStorage({ root, bucket: 'media', signingSecret: secret });
    service = new FailedEncodeService({ db: t.db, originals, media });
  });
  afterAll(async () => {
    await t?.drop();
    await rm(root, { recursive: true, force: true });
  });

  it('lists failed videos with the plain reason, the technical detail and what is left over', async () => {
    const video = await failed({ title: 'Broken lesson' });
    await t.db.insert(schema.jobs).values({
      queue: 'video.encode',
      videoId: video.id,
      status: 'failed',
      stage: 'Making 720p',
      errorCode: 'encode_failed',
      errorMessage: 'The video could not be converted.',
      errorDetail: 'ffmpeg exited with 1: Invalid data',
      attempts: 3,
    });
    const rows = await service.list();
    const row = rows.find((r) => r.videoId === video.id)!;
    expect(row).toMatchObject({
      title: 'Broken lesson',
      code: 'encode_failed',
      plain: 'The video could not be converted. Try exporting it again.',
      technical: 'ffmpeg exited with 1: Invalid data',
      stage: 'Making 720p',
      attempts: 3,
      hasOriginal: true,
      canRetry: true,
      leftover: { files: 4, bytes: 313 },
    });
  });

  it('does not list videos that are not failed or are in the trash', async () => {
    const ok = makeVideo({ status: 'ready', durationMs: 1000 });
    const trashed = await failed({ deletedAt: new Date() });
    await t.db.insert(schema.videos).values(ok);
    const ids = (await service.list()).map((r) => r.videoId);
    expect(ids).not.toContain(ok.id);
    expect(ids).not.toContain(trashed.id);
  });

  it('also removes a hero preview clip and forgets it, so Retry makes a fresh one (M41)', async () => {
    const video = await failed();
    const key = `cap/${video.mediaPrefix}/preview/0-aabbccdd.mp4`;
    await media.put(key, new Uint8Array(50));
    await t.db
      .update(schema.videos)
      .set({ previewKey: key, previewState: 'ready', previewBytes: 50 })
      .where(eq(schema.videos.id, video.id));
    await service.cleanup(video.id);
    expect(await media.head(key)).toBeNull();
    const [row] = await t.db.select().from(schema.videos).where(eq(schema.videos.id, video.id));
    expect(row).toMatchObject({ previewKey: null, previewState: 'none', previewBytes: null });
  });

  it('removes partial output, resets renditions and keeps the original, captions and the failure', async () => {
    const video = await failed();
    const out = await service.cleanup(video.id);
    expect(out).toEqual({ removedFiles: 4, freedBytes: 313 });
    expect(await media.list(`v/${video.mediaPrefix}/`)).toEqual([]);
    expect(await originals.list(`templates/${video.id}/`)).toEqual([]);
    expect(await media.head(`cap/${video.mediaPrefix}/sprites/map-aa.vtt`)).toBeNull();
    expect(await media.head(`cap/${video.mediaPrefix}/en.vtt`)).not.toBeNull();
    expect(await originals.head(video.originalKey!)).not.toBeNull();
    const rends = await t.db
      .select()
      .from(schema.renditions)
      .where(eq(schema.renditions.videoId, video.id));
    expect(rends).toEqual([]);
    const [row] = await t.db.select().from(schema.videos).where(eq(schema.videos.id, video.id));
    expect(row).toMatchObject({ status: 'failed', failureCode: 'encode_failed', spriteKey: null });
  });

  it('is safe to repeat', async () => {
    const video = await failed();
    await service.cleanup(video.id);
    expect(await service.cleanup(video.id)).toEqual({ removedFiles: 0, freedBytes: 0 });
  });

  it('refuses a video that is not failed and says when it does not exist', async () => {
    const ok = makeVideo({ status: 'ready', durationMs: 1000 });
    await t.db.insert(schema.videos).values(ok);
    await expect(service.cleanup(ok.id)).rejects.toBeInstanceOf(Conflict);
    await expect(service.cleanup('0192f0a0-0000-7000-8000-0000000000aa')).rejects.toBeInstanceOf(
      NotFound,
    );
  });

  it('cleans every failed video at once and reports the total', async () => {
    const a = await failed();
    const b = await failed();
    const out = await service.cleanupAll();
    expect(out.videos).toBeGreaterThanOrEqual(2);
    expect(await media.list(`v/${a.mediaPrefix}/`)).toEqual([]);
    expect(await media.list(`v/${b.mediaPrefix}/`)).toEqual([]);
  });

  it('marks a video with no original as one that needs a new file', async () => {
    const video = await failed({ originalKey: null });
    await t.db.update(schema.videos).set({ originalKey: null }).where(eq(schema.videos.id, video.id));
    const row = (await service.list()).find((r) => r.videoId === video.id)!;
    expect(row).toMatchObject({ hasOriginal: false, canRetry: false });
  });
});
