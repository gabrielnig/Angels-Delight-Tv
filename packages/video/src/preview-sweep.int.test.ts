import { schema } from '@ad/db';
import {
  createTestDatabase,
  integrationEnabled,
  makeAccount,
  makeVideo,
  type TestDatabase,
} from '@ad/db/testing';
import { DrizzleJobMirror, JobProducer, ensureQueues } from '@ad/queue';
import { FakeBoss } from '@ad/queue/testing';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PREVIEW_SWEEP_BATCH } from './preview';
import { sweepPreviews } from './preview-sweep';

describe.skipIf(!integrationEnabled())('sweepPreviews', () => {
  let t: TestDatabase;
  let owner: string;
  let producer: JobProducer;
  beforeAll(async () => {
    t = await createTestDatabase();
    const account = makeAccount({ role: 'editor' });
    await t.db.insert(schema.accounts).values(account);
    owner = account.id;
    const boss = new FakeBoss();
    await ensureQueues(boss);
    producer = new JobProducer({ boss, mirror: new DrizzleJobMirror(t.db) });
  });
  afterAll(async () => {
    await t?.drop();
  });

  const add = async (fields: Record<string, unknown> = {}) => {
    const video = makeVideo({
      createdBy: owner,
      status: 'ready',
      publishState: 'published',
      publishedAt: new Date(),
      durationMs: 60_000,
      width: 1280,
      height: 720,
      ...fields,
    });
    await t.db.insert(schema.videos).values({ ...video, originalKey: `originals/${video.id}/up`, ...(fields as object) });
    return video.id;
  };
  const queued = async (id: string) =>
    (await t.db.select().from(schema.jobs).where(eq(schema.jobs.videoId, id))).filter((j) => j.queue === 'video.preview');
  const state = async (id: string) =>
    (await t.db.select().from(schema.videos).where(eq(schema.videos.id, id)))[0]!.previewState;

  it('queues only published, live videos with no clip yet, and marks them queued', async () => {
    const wanted = await add();
    const draft = await add({ publishState: 'draft', publishedAt: null });
    const off = await add({ previewMode: 'off' });
    const done = await add({ previewState: 'ready' });
    const gone = await add({ deletedAt: new Date() });
    const noOriginal = await add({ originalKey: null });
    expect(await sweepPreviews({ db: t.db, producer })).toBeGreaterThanOrEqual(1);
    expect(await queued(wanted)).toHaveLength(1);
    expect(await state(wanted)).toBe('queued');
    for (const id of [draft, off, done, gone, noOriginal]) expect(await queued(id)).toHaveLength(0);
  });

  it('queues at most ten a run and leaves the rest for the next hour', async () => {
    const ids: string[] = [];
    for (let i = 0; i < PREVIEW_SWEEP_BATCH + 4; i++) ids.push(await add());
    const first = await sweepPreviews({ db: t.db, producer });
    expect(first).toBe(PREVIEW_SWEEP_BATCH);
    const second = await sweepPreviews({ db: t.db, producer });
    expect(second).toBeGreaterThanOrEqual(4);
    expect(await sweepPreviews({ db: t.db, producer })).toBe(0);
  });

  it('does not queue the same video twice', async () => {
    const id = await add();
    await sweepPreviews({ db: t.db, producer });
    await sweepPreviews({ db: t.db, producer });
    expect(await queued(id)).toHaveLength(1);
  });
});
