import { z } from 'zod';

export const QUEUES = {
  videoProbe: 'video.probe',
  videoEncode: 'video.encode',
  videoThumbnails: 'video.thumbnails',
  captionGenerate: 'caption.generate',
  imageProcess: 'image.process',
  videoRekey: 'video.rekey',
  videoPurge: 'video.purge',
  uploadsCleanup: 'uploads.cleanup',
  videosPurgeDeleted: 'videos.purge_deleted',
  analyticsRollup: 'analytics.rollup',
  analyticsPrune: 'analytics.prune',
  auditPrune: 'audit.prune',
} as const;

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];

export interface QueueDefinition {
  concurrency: number;
  retryLimit: number;
  retryDelaySeconds: number;
  /** Exponential backoff from retryDelaySeconds. */
  retryBackoff: boolean;
  expireInSeconds: number;
  /** Workers must refresh within this window or pg-boss retries the job (stalled job recovery). */
  heartbeatSeconds?: number;
}

/** ARCHITECTURE section 13. Concurrency can be overridden at registration, see registerWorker. */
export const QUEUE_DEFINITIONS: Record<QueueName, QueueDefinition> = {
  'video.probe': {
    concurrency: 2,
    retryLimit: 3,
    retryDelaySeconds: 30,
    retryBackoff: true,
    expireInSeconds: 10 * 60,
  },
  'video.encode': {
    concurrency: 1,
    retryLimit: 3,
    retryDelaySeconds: 120,
    retryBackoff: true,
    expireInSeconds: 3 * 3600,
    heartbeatSeconds: 300,
  },
  'video.thumbnails': {
    concurrency: 2,
    retryLimit: 3,
    retryDelaySeconds: 30,
    retryBackoff: true,
    expireInSeconds: 15 * 60,
  },
  'caption.generate': {
    concurrency: 1,
    retryLimit: 2,
    retryDelaySeconds: 120,
    retryBackoff: true,
    expireInSeconds: 45 * 60,
    heartbeatSeconds: 300,
  },
  'image.process': {
    concurrency: 2,
    retryLimit: 3,
    retryDelaySeconds: 15,
    retryBackoff: true,
    expireInSeconds: 5 * 60,
  },
  'video.rekey': {
    concurrency: 1,
    retryLimit: 2,
    retryDelaySeconds: 120,
    retryBackoff: true,
    expireInSeconds: 3 * 3600,
  },
  'video.purge': {
    concurrency: 1,
    retryLimit: 3,
    retryDelaySeconds: 60,
    retryBackoff: true,
    expireInSeconds: 30 * 60,
  },
  'uploads.cleanup': {
    concurrency: 1,
    retryLimit: 3,
    retryDelaySeconds: 300,
    retryBackoff: true,
    expireInSeconds: 30 * 60,
  },
  'videos.purge_deleted': {
    concurrency: 1,
    retryLimit: 2,
    retryDelaySeconds: 300,
    retryBackoff: true,
    expireInSeconds: 30 * 60,
  },
  // Maintenance jobs are idempotent and run on a schedule, so a few slow retries are enough.
  'analytics.rollup': {
    concurrency: 1,
    retryLimit: 3,
    retryDelaySeconds: 300,
    retryBackoff: true,
    expireInSeconds: 30 * 60,
  },
  'analytics.prune': {
    concurrency: 1,
    retryLimit: 2,
    retryDelaySeconds: 600,
    retryBackoff: true,
    expireInSeconds: 60 * 60,
  },
  'audit.prune': {
    concurrency: 1,
    retryLimit: 2,
    retryDelaySeconds: 600,
    retryBackoff: true,
    expireInSeconds: 60 * 60,
  },
};

export function queueOptions(name: QueueName) {
  const def = QUEUE_DEFINITIONS[name];
  return {
    retryLimit: def.retryLimit,
    retryDelay: def.retryDelaySeconds,
    retryBackoff: def.retryBackoff,
    expireInSeconds: def.expireInSeconds,
    retentionSeconds: 14 * 24 * 3600,
    deleteAfterSeconds: 24 * 3600,
    ...(def.heartbeatSeconds ? { heartbeatSeconds: def.heartbeatSeconds } : {}),
  };
}

const uuid = z.uuid();
const tracking = { jobId: uuid.optional() };

/** Payloads carry ids only (ARCHITECTURE section 13). `.strict()` rejects anything else. */
const videoPayload = z.strictObject({ videoId: uuid, ...tracking });

const PAYLOADS = {
  'video.probe': videoPayload,
  'video.encode': videoPayload,
  'video.thumbnails': videoPayload,
  'caption.generate': z.strictObject({
    videoId: uuid,
    mode: z.enum(['transcribe', 'align']).default('transcribe'),
    ...tracking,
  }),
  'image.process': z.strictObject({ assetId: uuid, ...tracking }),
  'video.rekey': videoPayload,
  'video.purge': videoPayload,
  'uploads.cleanup': z.strictObject({}),
  'videos.purge_deleted': z.strictObject({}),
  'analytics.rollup': z.strictObject({}),
  'analytics.prune': z.strictObject({}),
  'audit.prune': z.strictObject({}),
} satisfies Record<QueueName, z.ZodType>;

export type PayloadOf<Q extends QueueName> = z.output<(typeof PAYLOADS)[Q]>;
export type PayloadInput<Q extends QueueName> = z.input<(typeof PAYLOADS)[Q]>;

export function parsePayload<Q extends QueueName>(name: Q, data: unknown): PayloadOf<Q> {
  return PAYLOADS[name].parse(data ?? {}) as PayloadOf<Q>;
}

export interface CronEntry {
  queue: QueueName;
  cron: string;
  timezone: string;
}

/** Lane D schedules. Other lanes append theirs with their own entries when their queues exist. */
export const CRON_SCHEDULES: CronEntry[] = [
  { queue: 'uploads.cleanup', cron: '0 * * * *', timezone: 'Africa/Lagos' },
  { queue: 'videos.purge_deleted', cron: '30 3 * * *', timezone: 'Africa/Lagos' },
];

/**
 * Lane I jobs (analytics rollup, raw event prune, audit prune). The cron expressions match `ROLLUP_SCHEDULE`,
 * `RETENTION_SCHEDULE` and `AUDIT_RETENTION_SCHEDULE`, and a worker test pins that. Registered by `registerMaintenanceHandlers`.
 */
export const MAINTENANCE_CRON_SCHEDULES: CronEntry[] = [
  { queue: 'analytics.rollup', cron: '0 2 * * *', timezone: 'Africa/Lagos' },
  { queue: 'analytics.prune', cron: '0 3 1 * *', timezone: 'Africa/Lagos' },
  { queue: 'audit.prune', cron: '30 3 1 * *', timezone: 'Africa/Lagos' },
];
