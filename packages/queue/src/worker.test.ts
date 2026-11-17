import { describe, expect, it } from 'vitest';
import { QUEUES } from './definitions';
import { PermanentJobError, ensureQueues, registerWorker, scheduleCrons } from './worker';
import { JobProducer } from './producer';
import { FakeBoss, MemoryMirror } from './testing';
import { silentLogger } from './logging';

const videoId = '0192f0a0-0000-7000-8000-000000000001';

function setup() {
  const boss = new FakeBoss();
  const mirror = new MemoryMirror();
  const producer = new JobProducer({ boss, mirror });
  return { boss, mirror, producer };
}

describe('ensureQueues and scheduleCrons', () => {
  it('creates every queue once with its retry options and registers the crons', async () => {
    const { boss } = setup();
    await ensureQueues(boss);
    expect(boss.queues.get('video.encode')?.retryLimit).toBe(3);
    expect(boss.queues.size).toBe(Object.keys(QUEUES).length);
    await scheduleCrons(boss);
    expect(boss.schedules.find((s) => s.name === 'uploads.cleanup')).toMatchObject({
      tz: 'Africa/Lagos',
    });
  });
});

describe('JobProducer', () => {
  it('writes a queued mirror row and sends the job with the tracking id', async () => {
    const { boss, mirror, producer } = setup();
    await ensureQueues(boss);
    const result = await producer.enqueue('video.encode', { videoId });
    expect(result.deduped).toBe(false);
    expect(mirror.rows).toHaveLength(1);
    expect(boss.jobs[0]?.data).toEqual({ videoId, jobId: result.jobId });
    expect(mirror.rows[0]?.bossJobId).toBe(boss.jobs[0]?.id);
  });

  it('is idempotent while a job for the same video is open (M13-S09 AC2, M14-S01 AC2)', async () => {
    const { boss, mirror, producer } = setup();
    await ensureQueues(boss);
    const first = await producer.enqueue('video.encode', { videoId });
    const second = await producer.enqueue('video.encode', { videoId });
    expect(second).toMatchObject({ jobId: first.jobId, deduped: true });
    expect(boss.jobs).toHaveLength(1);
    expect(mirror.rows).toHaveLength(1);
  });

  it('rolls the mirror row back and reports a retryable error when the queue write fails (M14-S01 error)', async () => {
    const { boss, mirror, producer } = setup();
    await ensureQueues(boss);
    boss.failSends = true;
    await expect(producer.enqueue('video.encode', { videoId })).rejects.toThrow(/queue/i);
    expect(mirror.rows).toHaveLength(0);
  });

  it('rejects payloads with extra fields', async () => {
    const { boss, producer } = setup();
    await ensureQueues(boss);
    await expect(
      producer.enqueue('video.encode', { videoId, email: 'x' } as never),
    ).rejects.toThrow();
  });
});

describe('registerWorker', () => {
  const classify = (error: unknown) => ({
    code: error instanceof PermanentJobError ? 'bad_input' : 'transient',
    plain: error instanceof PermanentJobError ? 'Bad file.' : 'Trying again.',
    detail: String(error),
    permanent: error instanceof PermanentJobError,
  });

  async function start(
    handle: Parameters<typeof registerWorker<'video.encode'>>[1]['handle'],
    onFailed?: () => void,
  ) {
    const ctx = setup();
    await ensureQueues(ctx.boss);
    await registerWorker(ctx.boss, {
      queue: 'video.encode',
      mirror: ctx.mirror,
      logger: silentLogger,
      classify,
      handle,
      onFailed: onFailed ? async () => onFailed() : undefined,
    });
    return ctx;
  }

  it('marks running, runs the handler with progress, then succeeded', async () => {
    const { boss, mirror, producer } = await start(async (_payload, job) => {
      await job.progress('Encoding 360p', 40);
    });
    await producer.enqueue('video.encode', { videoId });
    await boss.drain('video.encode');
    expect(mirror.rows[0]).toMatchObject({ status: 'succeeded', progress: 100, attempts: 1 });
  });

  it('retries transient errors up to the queue limit then marks failed and calls onFailed once', async () => {
    let failedCalls = 0;
    const { boss, mirror, producer } = await start(
      async () => {
        throw new Error('storage down');
      },
      () => failedCalls++,
    );
    await producer.enqueue('video.encode', { videoId });
    const attempts = await boss.drain('video.encode');
    expect(attempts).toBe(4);
    expect(mirror.rows[0]).toMatchObject({
      status: 'failed',
      errorCode: 'transient',
      errorMessage: 'Trying again.',
    });
    expect(failedCalls).toBe(1);
  });

  it('shows queued with the last reason between retries', async () => {
    let seen: string | undefined;
    const { boss, mirror, producer } = await start(async (_payload, job) => {
      if (job.attempt === 1) throw new Error('blip');
      seen = mirror.rows[0]?.errorMessage ?? undefined;
    });
    await producer.enqueue('video.encode', { videoId });
    await boss.drain('video.encode');
    expect(seen).toBe('Trying again.');
    expect(mirror.rows[0]?.status).toBe('succeeded');
  });

  it('does not retry permanent errors: it records failed_permanent and completes the job (D-029)', async () => {
    let failedCalls = 0;
    const { boss, mirror, producer } = await start(
      async () => {
        throw new PermanentJobError('damaged');
      },
      () => failedCalls++,
    );
    await producer.enqueue('video.encode', { videoId });
    expect(await boss.drain('video.encode')).toBe(1);
    expect(mirror.rows[0]).toMatchObject({ status: 'failed_permanent', errorCode: 'bad_input' });
    expect(failedCalls).toBe(1);
  });

  it('treats an invalid payload as a permanent failure that never reaches the handler', async () => {
    let ran = false;
    const { boss } = await start(async () => {
      ran = true;
    });
    await boss.send('video.encode', { videoId: 'not-a-uuid' });
    await boss.drain('video.encode');
    expect(ran).toBe(false);
  });
});
