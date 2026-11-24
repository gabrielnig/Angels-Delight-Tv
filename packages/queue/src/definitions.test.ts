import { describe, expect, it } from 'vitest';
import {
  CRON_SCHEDULES,
  ENGAGE_CRON_SCHEDULES,
  EXPORT_CRON_SCHEDULES,
  MAIL_CRON_SCHEDULES,
  MAINTENANCE_CRON_SCHEDULES,
  QUEUES,
  QUEUE_DEFINITIONS,
  parsePayload,
  queueOptions,
} from './definitions';

describe('queue definitions', () => {
  it('matches the table in ARCHITECTURE section 13', () => {
    expect(QUEUE_DEFINITIONS['video.probe']).toMatchObject({
      concurrency: 2,
      retryLimit: 3,
      expireInSeconds: 600,
    });
    expect(QUEUE_DEFINITIONS['video.encode']).toMatchObject({
      concurrency: 1,
      retryLimit: 3,
      expireInSeconds: 3 * 3600,
    });
    expect(QUEUE_DEFINITIONS['caption.generate']).toMatchObject({
      concurrency: 1,
      retryLimit: 2,
      expireInSeconds: 45 * 60,
    });
    expect(QUEUE_DEFINITIONS['video.purge']).toMatchObject({ concurrency: 1, retryLimit: 3 });
  });

  it('keeps every queue name unique and listed once', () => {
    const names = Object.values(QUEUES);
    expect(new Set(names).size).toBe(names.length);
    expect(Object.keys(QUEUE_DEFINITIONS).sort()).toEqual([...names].sort());
  });

  it('turns a definition into pg-boss queue options with exponential backoff', () => {
    expect(queueOptions('video.encode')).toMatchObject({
      retryLimit: 3,
      retryBackoff: true,
      expireInSeconds: 10800,
    });
  });

  it('gives heavy queues a heartbeat so stalled jobs are retried (M14-S05)', () => {
    expect(QUEUE_DEFINITIONS['video.encode'].heartbeatSeconds).toBe(300);
  });

  it('schedules the lane D crons in Lagos time', () => {
    const cleanup = CRON_SCHEDULES.find((entry) => entry.queue === 'uploads.cleanup');
    expect(cleanup).toMatchObject({ cron: '0 * * * *', timezone: 'Africa/Lagos' });
    expect(CRON_SCHEDULES.some((entry) => entry.queue === 'videos.purge_deleted')).toBe(true);
  });
});

describe('maintenance queues', () => {
  it('defines rollup and both prunes with no payload fields', () => {
    for (const name of [
      'analytics.rollup',
      'analytics.prune',
      'audit.prune',
      'auth.login_events_prune',
    ] as const) {
      expect(QUEUE_DEFINITIONS[name]).toMatchObject({ concurrency: 1 });
      expect(parsePayload(name, {})).toEqual({});
      expect(() => parsePayload(name, { videoId: 'x' })).toThrow();
    }
  });

  it('keeps their schedules apart from the lane D crons', () => {
    expect(CRON_SCHEDULES.some((entry) => entry.queue === 'analytics.rollup')).toBe(false);
    expect(MAINTENANCE_CRON_SCHEDULES.map((entry) => entry.queue).sort()).toEqual([
      'analytics.prune',
      'analytics.rollup',
      'audit.prune',
      'auth.login_events_prune',
    ]);
    for (const entry of MAINTENANCE_CRON_SCHEDULES) expect(entry.timezone).toBe('Africa/Lagos');
  });
});

describe('mail queues (M15-S01, M21-S03)', () => {
  it('defines the outbox drain and the summary builder with no payload fields', () => {
    for (const name of ['email.outbox', 'email.digest'] as const) {
      expect(QUEUE_DEFINITIONS[name]).toMatchObject({ concurrency: 1 });
      expect(parsePayload(name, {})).toEqual({});
      expect(() => parsePayload(name, { to: 'a@example.org' })).toThrow();
    }
  });

  it('drains every minute and builds summaries at five past each hour, in Lagos time', () => {
    expect(MAIL_CRON_SCHEDULES).toEqual([
      { queue: 'email.outbox', cron: '* * * * *', timezone: 'Africa/Lagos' },
      { queue: 'email.digest', cron: '5 * * * *', timezone: 'Africa/Lagos' },
    ]);
  });

  it('keeps them apart from the other schedules', () => {
    const mail = MAIL_CRON_SCHEDULES.map((e) => e.queue);
    for (const entry of [...CRON_SCHEDULES, ...MAINTENANCE_CRON_SCHEDULES]) {
      expect(mail).not.toContain(entry.queue);
    }
  });
});

describe('export queues (M19-S05, M20-S03)', () => {
  const exportId = '0192f0a0-0000-7000-8000-000000000009';

  it('takes an export id only, and nothing else', () => {
    expect(parsePayload('exports.generate', { exportId })).toEqual({ exportId });
    expect(() => parsePayload('exports.generate', {})).toThrow();
    expect(() => parsePayload('exports.generate', { exportId, params: { from: 'x' } })).toThrow();
    expect(() => parsePayload('exports.generate', { exportId: 'not-an-id' })).toThrow();
    expect(parsePayload('exports.cleanup', {})).toEqual({});
  });

  it('gives a big export a long expiry and no blind retry storm', () => {
    expect(QUEUE_DEFINITIONS['exports.generate']).toMatchObject({ concurrency: 1, retryLimit: 1 });
    expect(QUEUE_DEFINITIONS['exports.generate'].expireInSeconds).toBeGreaterThanOrEqual(30 * 60);
  });

  it('cleans up once a day in Lagos time', () => {
    expect(MAIL_CRON_SCHEDULES.some((e) => e.queue === 'exports.cleanup')).toBe(false);
    expect(MAINTENANCE_CRON_SCHEDULES.some((e) => e.queue === 'exports.cleanup')).toBe(false);
    expect(EXPORT_CRON_SCHEDULES).toEqual([
      { queue: 'exports.cleanup', cron: '45 3 * * *', timezone: 'Africa/Lagos' },
    ]);
  });
});

describe('parsePayload', () => {
  const videoId = '0192f0a0-0000-7000-8000-000000000001';

  it('accepts ids only and an optional tracking id', () => {
    expect(parsePayload('video.encode', { videoId })).toEqual({ videoId });
    expect(
      parsePayload('video.encode', { videoId, jobId: '0192f0a0-0000-7000-8000-000000000002' }),
    ).toMatchObject({ videoId });
  });

  it('rejects other fields and bad ids so secrets and PII cannot ride along', () => {
    expect(() => parsePayload('video.encode', { videoId, email: 'a@b.c' })).toThrow();
    expect(() => parsePayload('video.encode', { videoId: 'nope' })).toThrow();
  });

  it('defaults caption mode to transcribe and allows align', () => {
    expect(parsePayload('caption.generate', { videoId })).toEqual({ videoId, mode: 'transcribe' });
    expect(parsePayload('caption.generate', { videoId, mode: 'align' }).mode).toBe('align');
    expect(() => parsePayload('caption.generate', { videoId, mode: 'x' })).toThrow();
  });

  it('allows an empty payload for cron queues', () => {
    expect(parsePayload('uploads.cleanup', {})).toEqual({});
  });
});

describe('engagement queues (L5, M44)', () => {
  it('queue definitions include ratings.rollup with concurrency 1, retry 3 and a 15 minute Lagos cron', () => {
    expect(QUEUE_DEFINITIONS['ratings.rollup']).toMatchObject({
      concurrency: 1,
      retryLimit: 3,
      retryDelaySeconds: 30,
      retryBackoff: true,
      expireInSeconds: 300,
    });
    expect(parsePayload('ratings.rollup', {})).toEqual({});
    expect(ENGAGE_CRON_SCHEDULES).toContainEqual({
      queue: 'ratings.rollup',
      cron: '*/15 * * * *',
      timezone: 'Africa/Lagos',
    });
  });
});

describe('trending queue (L5, M44-S07)', () => {
  it('defines trending.refresh with concurrency 1, retry 3 and an hourly cron at minute 10', () => {
    expect(QUEUE_DEFINITIONS['trending.refresh']).toMatchObject({
      concurrency: 1,
      retryLimit: 3,
      retryDelaySeconds: 60,
      expireInSeconds: 600,
    });
    expect(ENGAGE_CRON_SCHEDULES).toContainEqual({
      queue: 'trending.refresh',
      cron: '10 * * * *',
      timezone: 'Africa/Lagos',
    });
  });
});

describe('notice queues (L5, M44-S12)', () => {
  it('defines notices.fanout every 10 minutes and notices.prune nightly, both Lagos time', () => {
    expect(QUEUE_DEFINITIONS['notices.fanout']).toMatchObject({
      concurrency: 1,
      retryLimit: 3,
      retryDelaySeconds: 30,
      expireInSeconds: 300,
    });
    expect(QUEUE_DEFINITIONS['notices.prune']).toMatchObject({ concurrency: 1, retryLimit: 2, expireInSeconds: 600 });
    expect(parsePayload('notices.fanout', {})).toEqual({});
    expect(ENGAGE_CRON_SCHEDULES).toContainEqual({ queue: 'notices.fanout', cron: '*/10 * * * *', timezone: 'Africa/Lagos' });
    expect(ENGAGE_CRON_SCHEDULES).toContainEqual({ queue: 'notices.prune', cron: '40 3 * * *', timezone: 'Africa/Lagos' });
  });
});

describe('caption.translate queue (L7, M46)', () => {
  const videoId = '0192f0a0-0000-7000-8000-0000000000aa';
  it('runs one job at a time with two slow retries and a heartbeat', () => {
    expect(QUEUE_DEFINITIONS['caption.translate']).toMatchObject({
      concurrency: 1,
      retryLimit: 2,
      retryDelaySeconds: 120,
      retryBackoff: true,
      expireInSeconds: 30 * 60,
      heartbeatSeconds: 300,
    });
  });
  it('payload requires a known language and rejects extra keys', () => {
    expect(parsePayload('caption.translate', { videoId, targetLanguage: 'yo' })).toEqual({
      videoId,
      targetLanguage: 'yo',
      mode: 'new',
    });
    expect(() => parsePayload('caption.translate', { videoId, targetLanguage: 'fr' })).toThrow();
    expect(() => parsePayload('caption.translate', { videoId, targetLanguage: 'en' })).not.toThrow();
    expect(() => parsePayload('caption.translate', { videoId, targetLanguage: 'yo', extra: 1 })).toThrow();
    expect(() => parsePayload('caption.translate', { targetLanguage: 'yo' })).toThrow();
  });
  it('accepts a source revision and the retranslate mode', () => {
    const sourceCaptionId = '0192f0a0-0000-7000-8000-0000000000bb';
    expect(
      parsePayload('caption.translate', { videoId, targetLanguage: 'ha', sourceCaptionId, mode: 'retranslate' }),
    ).toMatchObject({ sourceCaptionId, mode: 'retranslate' });
  });
});
