import { PgBoss } from 'pg-boss';

export interface JobLike {
  id: string;
  name: string;
  data: object;
  retryCount: number;
  signal: AbortSignal;
}

export interface SendOptions {
  singletonKey?: string;
  startAfter?: number | string | Date;
  priority?: number;
}

export interface WorkOptions {
  localConcurrency?: number;
  pollingIntervalSeconds?: number;
}

export interface QueueCreateOptions {
  retryLimit?: number;
  retryDelay?: number;
  retryBackoff?: boolean;
  expireInSeconds?: number;
  retentionSeconds?: number;
  deleteAfterSeconds?: number;
  heartbeatSeconds?: number;
}

export interface ScheduleOptions {
  tz?: string;
  missed?: 'skip' | 'once';
}

/** The slice of pg-boss this lane uses, so everything is testable with FakeBoss. */
export interface BossLike {
  createQueue(name: string, options?: QueueCreateOptions): Promise<void>;
  send(name: string, data: object, options?: SendOptions): Promise<string | null>;
  work(
    name: string,
    options: WorkOptions,
    handler: (jobs: JobLike[]) => Promise<unknown>,
  ): Promise<unknown>;
  schedule(
    name: string,
    cron: string,
    data: object | null,
    options?: ScheduleOptions,
  ): Promise<void>;
}

/** pg-boss has heavily overloaded generics, this adapter pins the shape we use. */
export function bossAdapter(boss: PgBoss): BossLike {
  return {
    createQueue: (name, options) => boss.createQueue(name, options),
    send: (name, data, options) => boss.send(name, data, options),
    work: (name, options, handler) =>
      boss.work(name, options, handler as Parameters<typeof boss.work>[2]),
    schedule: (name, cron, data, options) => boss.schedule(name, cron, data, options),
  };
}

export interface ProducerOptions {
  connectionString: string;
  /** Small, the web app only sends jobs. */
  max?: number;
  onError?: (error: Error) => void;
}

/**
 * Producer-only client for apps/web (ARCHITECTURE section 13): no supervision, no cron, no migrations.
 * The worker must have started once so the queues exist.
 */
export async function createProducerBoss(options: ProducerOptions): Promise<PgBoss> {
  const boss = new PgBoss({
    connectionString: options.connectionString,
    max: options.max ?? 2,
    application_name: 'ad-web-producer',
    schema: 'pgboss',
    supervise: false,
    schedule: false,
    migrate: false,
    createSchema: false,
  });
  boss.on('error', options.onError ?? (() => undefined));
  await boss.start();
  return boss;
}
