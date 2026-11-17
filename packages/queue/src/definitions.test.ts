import { describe, expect, it } from 'vitest';
import {
  CRON_SCHEDULES,
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
