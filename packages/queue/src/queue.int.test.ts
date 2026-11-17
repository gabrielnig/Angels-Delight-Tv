import { createTestDatabase, integrationEnabled, type TestDatabase } from '@ad/db/testing';
import { jobs, schema } from '@ad/db';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import { PgBoss } from 'pg-boss';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bossAdapter, createProducerBoss } from './boss';
import { DrizzleJobMirror } from './mirror';
import { JobProducer } from './producer';
import { ensureQueues, registerWorker, PermanentJobError } from './worker';
import { silentLogger } from './logging';
import { makeVideo } from '@ad/db/testing';

function asRole(url: string, role: string): string {
  const parsed = new URL(url);
  parsed.searchParams.set('options', `-c role=${role}`);
  return parsed.toString();
}

async function waitFor<T>(read: () => Promise<T | undefined | false>, ms = 15000): Promise<T> {
  const end = Date.now() + ms;
  for (;;) {
    const value = await read();
    if (value) return value;
    if (Date.now() > end) throw new Error('timed out waiting');
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

describe.skipIf(!integrationEnabled())('queue against real pg-boss and Postgres', () => {
  let t: TestDatabase;
  let workerBoss: PgBoss;
  let producerBoss: PgBoss;
  let appPool: pg.Pool;
  let workerPool: pg.Pool;
  let workerMirror: DrizzleJobMirror;
  let appMirror: DrizzleJobMirror;

  beforeAll(async () => {
    t = await createTestDatabase();
    workerBoss = new PgBoss({
      connectionString: asRole(t.url, 'ad_worker'),
      max: 4,
      schema: 'pgboss',
      createSchema: false,
    });
    workerBoss.on('error', () => undefined);
    await workerBoss.start();
    await ensureQueues(bossAdapter(workerBoss));

    producerBoss = await createProducerBoss({ connectionString: asRole(t.url, 'ad_app') });

    workerPool = new pg.Pool({ connectionString: asRole(t.url, 'ad_worker'), max: 2 });
    appPool = new pg.Pool({ connectionString: asRole(t.url, 'ad_app'), max: 2 });
    workerMirror = new DrizzleJobMirror(drizzle(workerPool, { schema }));
    appMirror = new DrizzleJobMirror(drizzle(appPool, { schema }));
  });

  afterAll(async () => {
    await producerBoss?.stop({ graceful: false });
    await workerBoss?.stop({ graceful: false, timeout: 5000 });
    await workerPool?.end();
    await appPool?.end();
    await t?.drop();
  });

  async function newVideo() {
    const video = makeVideo();
    await t.db.insert(schema.videos).values(video);
    return video.id;
  }

  it('lets the web role enqueue into queues the worker role created (D-019 default privileges)', async () => {
    const videoId = await newVideo();
    const producer = new JobProducer({ boss: bossAdapter(producerBoss), mirror: appMirror });
    const result = await producer.enqueue('video.probe', { videoId });
    expect(result.deduped).toBe(false);
    const again = await producer.enqueue('video.probe', { videoId });
    expect(again).toEqual({ jobId: result.jobId, deduped: true });
    const [row] = await t.db.select().from(jobs).where(eq(jobs.id, result.jobId));
    expect(row).toMatchObject({ queue: 'video.probe', status: 'queued', videoId });
    expect(row?.bossJobId).toBeTruthy();
  });

  it('runs a job end to end: mirror goes running, progresses, succeeds', async () => {
    const videoId = await newVideo();
    let seenAttempt = 0;
    await registerWorker(bossAdapter(workerBoss), {
      queue: 'video.thumbnails',
      mirror: workerMirror,
      logger: silentLogger,
      async handle(_payload, job) {
        seenAttempt = job.attempt;
        await job.progress('Making thumbnails', 50);
      },
    });
    const producer = new JobProducer({ boss: bossAdapter(producerBoss), mirror: appMirror });
    const { jobId } = await producer.enqueue('video.thumbnails', { videoId });
    const row = await waitFor(async () => {
      const [r] = await t.db.select().from(jobs).where(eq(jobs.id, jobId));
      return r?.status === 'succeeded' ? r : false;
    });
    expect(seenAttempt).toBe(1);
    expect(row).toMatchObject({ progress: 100, stage: 'Done', attempts: 1 });
    expect(row.startedAt).toBeTruthy();
    expect(row.finishedAt).toBeTruthy();
  });

  it('records a permanent failure with plain words and technical detail kept apart', async () => {
    const videoId = await newVideo();
    await registerWorker(bossAdapter(workerBoss), {
      queue: 'video.purge',
      mirror: workerMirror,
      logger: silentLogger,
      classify: (error) => ({
        code: 'damaged_file',
        plain: 'The video file is damaged. Try exporting it again.',
        detail: String(error),
        permanent: true,
      }),
      async handle() {
        throw new PermanentJobError('moov atom not found');
      },
    });
    const producer = new JobProducer({ boss: bossAdapter(producerBoss), mirror: appMirror });
    const { jobId } = await producer.enqueue('video.purge', { videoId });
    const row = await waitFor(async () => {
      const [r] = await t.db.select().from(jobs).where(eq(jobs.id, jobId));
      return r?.status === 'failed_permanent' ? r : false;
    });
    expect(row.errorMessage).toBe('The video file is damaged. Try exporting it again.');
    expect(row.errorDetail).toContain('moov atom');
    expect(row.errorMessage).not.toContain('moov');
  });

  it('finds running jobs whose heartbeat went quiet', async () => {
    const videoId = await newVideo();
    const { id } = await workerMirror.open({ queue: 'video.encode', videoId });
    await workerMirror.running(id, 1);
    await t.pool.query(
      "UPDATE jobs SET heartbeat_at = now() - interval '10 minutes' WHERE id = $1",
      [id],
    );
    const stalled = await workerMirror.stalled(300);
    expect(stalled.map((row) => row.id)).toContain(id);
  });

  it('allows a new open job once the previous one failed', async () => {
    const videoId = await newVideo();
    const first = await workerMirror.open({ queue: 'video.encode', videoId });
    await workerMirror.failed(first.id, { code: 'x', plain: 'x', detail: 'x' }, false);
    const second = await workerMirror.open({ queue: 'video.encode', videoId });
    expect(second.created).toBe(true);
    expect(second.id).not.toBe(first.id);
  });
});
