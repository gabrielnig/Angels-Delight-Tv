import { schema } from '@ad/db';
import {
  createTestDatabase,
  integrationEnabled,
  makeAccount,
  type TestDatabase,
} from '@ad/db/testing';
import { FakeBoss, MemoryMirror } from '@ad/queue/testing';
import { JobProducer, DrizzleJobMirror, ensureQueues } from '@ad/queue';
import { Conflict, Forbidden, NotFound, ValidationFailed, type Actor } from '@ad/shared';
import { LocalStorage } from '@ad/storage';
import { eq } from 'drizzle-orm';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { UploadIncomplete, UploadService } from './service';

const MIB = 1024 * 1024;
const secret = new Uint8Array(32).fill(3);

describe.skipIf(!integrationEnabled())('UploadService against Postgres and local storage', () => {
  let t: TestDatabase;
  let root: string;
  let originals: LocalStorage;
  let media: LocalStorage;
  let boss: FakeBoss;
  let now = new Date('2026-11-17T10:00:00Z');
  let editorA: Actor;
  let editorB: Actor;
  let admin: Actor;
  let viewer: Actor;
  let service: UploadService;
  let counter = 0;

  async function account(role: 'viewer' | 'editor' | 'admin'): Promise<Actor> {
    const row = makeAccount({ role });
    await t.db.insert(schema.accounts).values(row);
    return { accountId: row.id, role };
  }

  const request = (overrides: Record<string, unknown> = {}) => ({
    name: `Lesson_${++counter}.mp4`,
    size: 11 * MIB,
    type: 'video/mp4',
    fingerprint: `fingerprint-${counter}-abcdef`,
    ...overrides,
  });

  async function putParts(uploadId: string, which: number[], sizes?: Record<number, number>) {
    const [session] = await t.db
      .select()
      .from(schema.uploadSessions)
      .where(eq(schema.uploadSessions.id, uploadId));
    for (const n of which) {
      const size =
        sizes?.[n] ??
        (n < session!.totalParts
          ? session!.partSizeBytes
          : session!.sizeBytes - session!.partSizeBytes * (session!.totalParts - 1));
      await originals.receivePart(
        session!.storageKey,
        session!.s3UploadId,
        n,
        new Uint8Array(size),
      );
    }
  }

  beforeAll(async () => {
    t = await createTestDatabase();
    root = await mkdtemp(join(tmpdir(), 'ad-upload-'));
    originals = new LocalStorage({ root, bucket: 'originals', signingSecret: secret });
    media = new LocalStorage({ root, bucket: 'media', signingSecret: secret });
    boss = new FakeBoss();
    await ensureQueues(boss);
    const producer = new JobProducer({ boss, mirror: new DrizzleJobMirror(t.db) });
    editorA = await account('editor');
    editorB = await account('editor');
    admin = await account('admin');
    viewer = await account('viewer');
    service = new UploadService({
      db: t.db,
      originals,
      media,
      producer,
      limits: { maxBytes: 5 * 1024 * MIB, partBytes: 5 * MIB },
      clock: () => now,
    });
  });

  afterAll(async () => {
    await t?.drop();
    if (root) await rm(root, { recursive: true, force: true });
  });

  it('creates a draft video and an upload session with the part plan', async () => {
    const result = await service.create(editorA, request({ name: '  Intro_to_Algebra.MP4' }));
    expect(result).toMatchObject({
      partSize: 5 * MIB,
      totalParts: 3,
      resumed: false,
      uploadedParts: [],
    });
    const [video] = await t.db
      .select()
      .from(schema.videos)
      .where(eq(schema.videos.id, result.videoId));
    expect(video).toMatchObject({
      title: 'Intro to Algebra',
      status: 'uploading',
      publishState: 'draft',
      createdBy: editorA.accountId,
    });
    const [session] = await t.db
      .select()
      .from(schema.uploadSessions)
      .where(eq(schema.uploadSessions.id, result.uploadId));
    expect(session).toMatchObject({ status: 'initiated', totalParts: 3, kind: 'video' });
    expect(session!.storageKey).toBe(`originals/${result.videoId}/${result.uploadId}`);
    expect(session!.expiresAt.getTime()).toBe(now.getTime() + 48 * 3600 * 1000);
  });

  it('returns the same session for the same fingerprint so a re-selected file resumes', async () => {
    const req = request();
    const first = await service.create(editorA, req);
    await putParts(first.uploadId, [1]);
    const again = await service.create(editorA, req);
    expect(again).toMatchObject({ uploadId: first.uploadId, resumed: true, uploadedParts: [1] });
  });

  it('rejects invalid requests without creating anything', async () => {
    const before = await t.db.select().from(schema.videos);
    await expect(service.create(editorA, request({ name: 'x.exe' }))).rejects.toBeInstanceOf(
      ValidationFailed,
    );
    await expect(
      service.create(editorA, request({ size: 6 * 1024 * 1024 * MIB })),
    ).rejects.toBeInstanceOf(ValidationFailed);
    expect((await t.db.select().from(schema.videos)).length).toBe(before.length);
  });

  it('allows only editors and admins to upload', async () => {
    await expect(service.create(viewer, request())).rejects.toBeInstanceOf(Forbidden);
  });

  it('shows the uploaded parts from the bucket, to the owner and admins only', async () => {
    const { uploadId } = await service.create(editorA, request());
    await putParts(uploadId, [1, 3]);
    expect(await service.describe(editorA, uploadId)).toMatchObject({
      uploadedParts: [1, 3],
      status: 'uploading',
    });
    expect((await service.describe(admin, uploadId)).uploadId).toBe(uploadId);
    await expect(service.describe(editorB, uploadId)).rejects.toBeInstanceOf(NotFound);
  });

  it('signs part urls for the exact part size and refuses numbers outside the plan', async () => {
    const { uploadId } = await service.create(editorA, request());
    const urls = await service.presignParts(editorA, uploadId, [1, 3]);
    expect(Object.keys(urls)).toEqual(['1', '3']);
    expect(new URL(urls['3']!, 'http://x').searchParams.get('size')).toBe(String(1 * MIB));
    expect(new URL(urls['1']!, 'http://x').searchParams.get('size')).toBe(String(5 * MIB));
    await expect(service.presignParts(editorA, uploadId, [4])).rejects.toBeInstanceOf(
      ValidationFailed,
    );
    await expect(service.presignParts(editorA, uploadId, [0])).rejects.toBeInstanceOf(
      ValidationFailed,
    );
  });

  it('completes: verifies parts, marks the video uploaded and queues one probe job, idempotently', async () => {
    const { uploadId, videoId } = await service.create(editorA, request());
    await putParts(uploadId, [1, 2, 3]);
    const done = await service.complete(editorA, uploadId);
    expect(done).toMatchObject({ videoId, status: 'completed' });
    const [video] = await t.db.select().from(schema.videos).where(eq(schema.videos.id, videoId));
    expect(video).toMatchObject({ status: 'uploaded', originalBytes: 11 * MIB });
    expect(video!.originalKey).toBe(`originals/${videoId}/${uploadId}`);
    expect(await originals.head(video!.originalKey!)).toMatchObject({ bytes: 11 * MIB });
    const again = await service.complete(editorA, uploadId);
    expect(again.status).toBe('completed');
    const probeJobs = await t.db.select().from(schema.jobs).where(eq(schema.jobs.videoId, videoId));
    expect(probeJobs).toHaveLength(1);
    expect(probeJobs[0]).toMatchObject({ queue: 'video.probe', createdBy: editorA.accountId });
  });

  it('reports missing parts, returns to uploading and then completes once they arrive (M13-S09 error)', async () => {
    const { uploadId } = await service.create(editorA, request());
    await putParts(uploadId, [1, 3]);
    const error = await service.complete(editorA, uploadId).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(UploadIncomplete);
    expect((error as UploadIncomplete).missing).toEqual([2]);
    expect((await service.describe(editorA, uploadId)).status).toBe('uploading');
    await putParts(uploadId, [2]);
    expect((await service.complete(editorA, uploadId)).status).toBe('completed');
  });

  it('aborts and fails an upload whose total differs from the declared size', async () => {
    const { uploadId, videoId } = await service.create(editorA, request());
    await putParts(uploadId, [1, 2, 3], { 3: 2 * MIB });
    await expect(service.complete(editorA, uploadId)).rejects.toBeInstanceOf(ValidationFailed);
    const [session] = await t.db
      .select()
      .from(schema.uploadSessions)
      .where(eq(schema.uploadSessions.id, uploadId));
    expect(session).toMatchObject({ status: 'failed' });
    expect(session!.errorMessage).toMatch(/size/i);
    const [video] = await t.db.select().from(schema.videos).where(eq(schema.videos.id, videoId));
    expect(video?.status).toBe('failed');
  });

  it('cancels an upload: aborts storage and removes the draft video', async () => {
    const { uploadId, videoId } = await service.create(editorA, request());
    await putParts(uploadId, [1]);
    await service.abort(editorA, uploadId);
    expect(
      (await t.db.select().from(schema.videos).where(eq(schema.videos.id, videoId))).length,
    ).toBe(0);
    const done = await service.create(editorA, request());
    await putParts(done.uploadId, [1, 2, 3]);
    await service.complete(editorA, done.uploadId);
    await expect(service.abort(editorA, done.uploadId)).rejects.toBeInstanceOf(Conflict);
  });

  it('refuses part urls once the session is no longer open', async () => {
    const { uploadId } = await service.create(editorA, request());
    await service.abort(editorA, uploadId);
    await expect(service.presignParts(editorA, uploadId, [1])).rejects.toBeInstanceOf(Conflict);
  });

  it('expires sessions idle for 48 hours and keeps fresh ones (M13-S11)', async () => {
    const stale = await service.create(editorA, request());
    now = new Date(now.getTime() + 30 * 3600 * 1000);
    const fresh = await service.create(editorA, request());
    now = new Date(now.getTime() + 20 * 3600 * 1000);
    const result = await service.cleanupExpired();
    expect(result.failed).toBe(0);
    expect(result.expired).toBeGreaterThanOrEqual(1);
    const [s] = await t.db
      .select()
      .from(schema.uploadSessions)
      .where(eq(schema.uploadSessions.id, stale.uploadId));
    expect(s?.status).toBe('expired');
    expect(
      (await t.db.select().from(schema.videos).where(eq(schema.videos.id, stale.videoId))).length,
    ).toBe(0);
    const [f] = await t.db
      .select()
      .from(schema.uploadSessions)
      .where(eq(schema.uploadSessions.id, fresh.uploadId));
    expect(f?.status).toBe('initiated');
  });

  it('flags a possible duplicate of an already uploaded file by name and size (M13-S07 edge)', async () => {
    const req = request({ name: 'dupe-lesson.mp4' });
    const first = await service.create(editorA, req);
    await putParts(first.uploadId, [1, 2, 3]);
    await service.complete(editorA, first.uploadId);
    const second = await service.create(editorA, { ...req, fingerprint: 'another-fingerprint-1' });
    expect(second.duplicateOf).toMatchObject({ videoId: first.videoId });
  });

  it('limits unfinished uploads per person', async () => {
    const limited = new UploadService({
      db: t.db,
      originals,
      media,
      producer: new JobProducer({ boss, mirror: new MemoryMirror() }),
      limits: { maxBytes: 5 * 1024 * MIB, partBytes: 5 * MIB },
      maxPendingPerCreator: 2,
      clock: () => now,
    });
    const person = await account('editor');
    await limited.create(person, request());
    await limited.create(person, request());
    await expect(limited.create(person, request())).rejects.toBeInstanceOf(Conflict);
  });

  it('replaces the source of an unpublished video: old file and renditions go, a new probe is queued', async () => {
    const first = await service.create(editorA, request());
    await putParts(first.uploadId, [1, 2, 3]);
    await service.complete(editorA, first.uploadId);
    const [before] = await t.db
      .select()
      .from(schema.videos)
      .where(eq(schema.videos.id, first.videoId));
    await media.put(`v/${before!.mediaPrefix}/360/seg_00000.ts`, new Uint8Array(4));
    await t.db
      .insert(schema.renditions)
      .values({ videoId: first.videoId, height: 360, width: 640, videoKbps: 500, audioKbps: 96 });

    const replacement = await service.create(editorA, request(), { replaceVideoId: first.videoId });
    expect(replacement.videoId).toBe(first.videoId);
    await putParts(replacement.uploadId, [1, 2, 3]);
    await service.complete(editorA, replacement.uploadId);

    const [after] = await t.db
      .select()
      .from(schema.videos)
      .where(eq(schema.videos.id, first.videoId));
    expect(after!.originalKey).toBe(`originals/${first.videoId}/${replacement.uploadId}`);
    expect(after!.mediaPrefix).not.toBe(before!.mediaPrefix);
    expect(await originals.head(before!.originalKey!)).toBeNull();
    expect(await media.list(`v/${before!.mediaPrefix}/`)).toHaveLength(0);
    expect(
      await t.db
        .select()
        .from(schema.renditions)
        .where(eq(schema.renditions.videoId, first.videoId)),
    ).toHaveLength(0);
    const jobs = await t.db
      .select()
      .from(schema.jobs)
      .where(eq(schema.jobs.videoId, first.videoId));
    expect(jobs.filter((j) => j.status === 'queued')).toHaveLength(1);
  });

  it('will not replace a published video', async () => {
    const first = await service.create(editorA, request());
    await putParts(first.uploadId, [1, 2, 3]);
    await service.complete(editorA, first.uploadId);
    await t.pool.query(
      "UPDATE videos SET status='ready', duration_ms=1000, publish_state='published' WHERE id=$1",
      [first.videoId],
    );
    await expect(
      service.create(editorA, request(), { replaceVideoId: first.videoId }),
    ).rejects.toBeInstanceOf(Conflict);
  });
});
