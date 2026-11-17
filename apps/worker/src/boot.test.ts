import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';
import { createLogger } from '@ad/shared';
import { bootWorker, type BossLike } from './boot';

class FakeBoss extends EventEmitter implements BossLike {
  started = 0;
  stopped: unknown[] = [];
  failOnStart: Error | null = null;

  async start() {
    if (this.failOnStart) throw this.failOnStart;
    this.started += 1;
    return this;
  }

  async stop(options?: { graceful?: boolean; timeout?: number }) {
    this.stopped.push(options);
  }
}

function setup() {
  const lines: Record<string, unknown>[] = [];
  const logger = createLogger({
    write: (line) => lines.push(JSON.parse(line) as Record<string, unknown>),
  });
  const boss = new FakeBoss();
  const createBoss = vi.fn(() => boss);
  const env = {
    DATABASE_URL_WORKER: 'postgres://ad_worker:dev@localhost:5432/ad',
    NODE_ENV: 'development' as const,
  };
  return { lines, logger, boss, createBoss, env };
}

describe('bootWorker', () => {
  it('connects pg-boss with the worker database url and a small pool', async () => {
    const { logger, createBoss, env } = setup();
    await bootWorker({ env, logger, createBoss });
    expect(createBoss).toHaveBeenCalledWith(
      expect.objectContaining({
        connectionString: env.DATABASE_URL_WORKER,
        max: 4,
        application_name: 'ad-worker',
        schema: 'pgboss',
        createSchema: false,
      }),
    );
  });

  it('starts the queue and logs that the worker is ready', async () => {
    const { logger, boss, lines, createBoss, env } = setup();
    await bootWorker({ env, logger, createBoss });
    expect(boss.started).toBe(1);
    expect(lines.map((line) => line.msg)).toContain('worker ready');
  });

  it('never logs the database url', async () => {
    const { logger, lines, createBoss, env } = setup();
    await bootWorker({ env, logger, createBoss });
    expect(JSON.stringify(lines)).not.toContain('ad_worker:dev');
  });

  it('logs queue errors at error level instead of crashing the process', async () => {
    const { logger, boss, lines, createBoss, env } = setup();
    await bootWorker({ env, logger, createBoss });
    boss.emit('error', new Error('connection lost'));
    const entry = lines.find((line) => line.msg === 'queue error');
    expect(entry).toMatchObject({ level: 'error' });
  });

  it('stops pg-boss gracefully and logs it', async () => {
    const { logger, boss, lines, createBoss, env } = setup();
    const worker = await bootWorker({ env, logger, createBoss });
    await worker.stop();
    expect(boss.stopped).toEqual([{ graceful: true, timeout: 30_000 }]);
    expect(lines.map((line) => line.msg)).toContain('worker stopped');
  });

  it('propagates a start failure so the process exits non zero', async () => {
    const { logger, boss, createBoss, env } = setup();
    boss.failOnStart = new Error('permission denied for schema pgboss');
    await expect(bootWorker({ env, logger, createBoss })).rejects.toThrow('permission denied');
  });
});
