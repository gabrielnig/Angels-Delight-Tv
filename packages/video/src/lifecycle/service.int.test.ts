import { schema } from '@ad/db';
import { createTestDatabase, integrationEnabled, makeVideo, type TestDatabase } from '@ad/db/testing';
import { DrizzleJobMirror, JobProducer, ensureQueues } from '@ad/queue';
import { FakeBoss } from '@ad/queue/testing';
import { LocalStorage } from '@ad/storage';
import { eq } from 'drizzle-orm';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { LifecycleService } from './service';

const secret = new Uint8Array(32).fill(6);
const bytes = new Uint8Array([1, 2, 3]);

describe.skipIf(!integrationEnabled())('LifecycleService against Postgres', () => {
  let t: TestDatabase;
  let root: string;
  let originals: LocalStorage;
  let media: LocalStorage;
  let boss: FakeBoss;
  let service: LifecycleService;
  const now = new Date('2026-06-01T00:00:00Z');

  async function seed(deletedAt: Date | null) {
    const video = makeVideo({ status: 'ready', durationMs: 5000, deletedAt });
    await t.db.insert(schema.videos).values(video);
    const id = video.id;
    const p = video.mediaPrefix;
    await originals.put(`originals/${id}/s1`, bytes);
    await originals.put(`templates/${id}/master.m3u8`, bytes);
    await originals.put(`captions-draft/${id}/en/r1.vtt`, bytes);
    await originals.put(`scripts/${id}.txt`, bytes);
    await media.put(`v/${p}/720/seg_00001.ts`, bytes);
    await media.put(`cap/${p}/en.vtt`, bytes);
    return video;
  }

  beforeAll(async () => {
    t = await createTestDatabase();
    root = await mkdtemp(join(tmpdir(), 'ad-life-'));
    originals = new LocalStorage({ root, bucket: 'originals', signingSecret: secret });
    media = new LocalStorage({ root, bucket: 'media', signingSecret: secret });
    boss = new FakeBoss();
    await ensureQueues(boss);
    service = new LifecycleService({
      db: t.db,
      originals,
      media,
      producer: new JobProducer({ boss, mirror: new DrizzleJobMirror(t.db) }),
      graceDays: 30,
      clock: () => now,
    });
  });
  afterAll(async () => {
    await t?.drop();
    await rm(root, { recursive: true, force: true });
  });

  it('purges every stored object and the row of a soft deleted video', async () => {
    const video = await seed(new Date('2026-01-01T00:00:00Z'));
    await service.purge(video.id);
    expect(await originals.list(`originals/${video.id}/`)).toEqual([]);
    expect(await originals.list(`templates/${video.id}/`)).toEqual([]);
    expect(await originals.list(`captions-draft/${video.id}/`)).toEqual([]);
    expect(await originals.head(`scripts/${video.id}.txt`)).toBeNull();
    expect(await media.list(`v/${video.mediaPrefix}/`)).toEqual([]);
    expect(await media.list(`cap/${video.mediaPrefix}/`)).toEqual([]);
    const rows = await t.db.select().from(schema.videos).where(eq(schema.videos.id, video.id));
    expect(rows).toEqual([]);
  });

  it('refuses to purge a video that is not soft deleted', async () => {
    const video = await seed(null);
    await expect(service.purge(video.id)).rejects.toThrow(/not deleted/);
    expect(await media.list(`v/${video.mediaPrefix}/`)).toHaveLength(1);
  });

  it('is a no-op for a video that is already gone', async () => {
    await expect(service.purge('0192f0a0-0000-7000-8000-00000000dead')).resolves.toBeUndefined();
  });

  it('queues purge jobs only for videos past the grace period', async () => {
    const old = await seed(new Date('2026-04-01T00:00:00Z'));
    const recent = await seed(new Date('2026-05-25T00:00:00Z'));
    const result = await service.enqueueExpired();
    expect(result.queued).toBeGreaterThanOrEqual(1);
    const jobs = await t.db.select().from(schema.jobs).where(eq(schema.jobs.queue, 'video.purge'));
    const ids = jobs.map((j) => j.videoId);
    expect(ids).toContain(old.id);
    expect(ids).not.toContain(recent.id);
  });
});
