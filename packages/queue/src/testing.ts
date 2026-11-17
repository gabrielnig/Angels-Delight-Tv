import { randomUUID } from 'node:crypto';
import type { BossLike, JobLike, SendOptions, WorkOptions } from './boss';
import type { FailureRecord, JobMirror, OpenInput } from './mirror';

interface StoredJob {
  id: string;
  name: string;
  data: Record<string, unknown>;
  retryCount: number;
  singletonKey?: string;
}

/** In-memory pg-boss stand-in. drain() runs queued jobs and requeues failures up to the queue retry limit. */
export class FakeBoss implements BossLike {
  queues = new Map<string, { retryLimit: number }>();
  handlers = new Map<string, (jobs: JobLike[]) => Promise<unknown>>();
  jobs: StoredJob[] = [];
  schedules: { name: string; cron: string; tz?: string }[] = [];
  failSends = false;

  async createQueue(name: string, options?: { retryLimit?: number }) {
    this.queues.set(name, { retryLimit: options?.retryLimit ?? 0 });
  }

  async send(name: string, data: object, options?: SendOptions) {
    if (this.failSends) throw new Error('queue unavailable');
    if (!this.queues.has(name)) throw new Error(`Queue ${name} does not exist`);
    const duplicate = options?.singletonKey
      ? this.jobs.find((job) => job.name === name && job.singletonKey === options.singletonKey)
      : undefined;
    if (duplicate) return null;
    const job: StoredJob = {
      id: randomUUID(),
      name,
      data: data as Record<string, unknown>,
      retryCount: 0,
      singletonKey: options?.singletonKey,
    };
    this.jobs.push(job);
    return job.id;
  }

  async work(name: string, _options: WorkOptions, handler: (jobs: JobLike[]) => Promise<unknown>) {
    this.handlers.set(name, handler);
    return randomUUID();
  }

  async schedule(
    name: string,
    cron: string,
    _data: object | null,
    options?: { tz?: string; missed?: string },
  ) {
    this.schedules.push({ name, cron, tz: options?.tz });
  }

  /** Runs every job of a queue to completion, including retries. Returns how many attempts ran. */
  async drain(name: string): Promise<number> {
    const handler = this.handlers.get(name);
    if (!handler) throw new Error(`No handler for ${name}`);
    let attempts = 0;
    for (;;) {
      const index = this.jobs.findIndex((job) => job.name === name);
      if (index === -1) return attempts;
      const job = this.jobs[index]!;
      attempts++;
      try {
        await handler([
          {
            id: job.id,
            name,
            data: job.data,
            retryCount: job.retryCount,
            signal: new AbortController().signal,
          },
        ]);
        this.jobs.splice(index, 1);
      } catch {
        const limit = this.queues.get(name)?.retryLimit ?? 0;
        if (job.retryCount >= limit) this.jobs.splice(index, 1);
        else job.retryCount++;
      }
    }
  }
}

interface MemoryRow extends FailureRecordFields {
  id: string;
  queue: string;
  videoId?: string;
  assetId?: string;
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'failed_permanent' | 'cancelled';
  stage: string | null;
  progress: number;
  attempts: number;
  bossJobId: string | null;
}
interface FailureRecordFields {
  errorCode: string | null;
  errorMessage: string | null;
  errorDetail: string | null;
}

export class MemoryMirror implements JobMirror {
  rows: MemoryRow[] = [];

  async open(input: OpenInput) {
    const existing = this.rows.find(
      (row) =>
        row.queue === input.queue &&
        row.videoId === input.videoId &&
        input.videoId !== undefined &&
        (row.status === 'queued' || row.status === 'running'),
    );
    if (existing) return { id: existing.id, created: false };
    const row: MemoryRow = {
      id: randomUUID(),
      queue: input.queue,
      videoId: input.videoId,
      assetId: input.assetId,
      status: 'queued',
      stage: 'Queued',
      progress: 0,
      attempts: 0,
      bossJobId: null,
      errorCode: null,
      errorMessage: null,
      errorDetail: null,
    };
    this.rows.push(row);
    return { id: row.id, created: true };
  }
  private row(id: string): MemoryRow {
    const row = this.rows.find((r) => r.id === id);
    if (!row) throw new Error('no such mirror row');
    return row;
  }
  async discard(id: string) {
    this.rows = this.rows.filter((row) => row.id !== id);
  }
  async attach(id: string, bossJobId: string | null) {
    this.row(id).bossJobId = bossJobId;
  }
  async running(id: string, attempt: number) {
    Object.assign(this.row(id), { status: 'running', attempts: attempt });
  }
  async progress(id: string, stage: string, percent: number) {
    Object.assign(this.row(id), { stage, progress: percent });
  }
  async succeeded(id: string) {
    Object.assign(this.row(id), { status: 'succeeded', stage: 'Done', progress: 100 });
  }
  async retrying(id: string, failure: FailureRecord) {
    Object.assign(this.row(id), {
      status: 'queued',
      stage: 'Waiting to retry',
      errorCode: failure.code,
      errorMessage: failure.plain,
      errorDetail: failure.detail,
    });
  }
  async failed(id: string, failure: FailureRecord, permanent: boolean) {
    Object.assign(this.row(id), {
      status: permanent ? 'failed_permanent' : 'failed',
      errorCode: failure.code,
      errorMessage: failure.plain,
      errorDetail: failure.detail,
    });
  }
}
