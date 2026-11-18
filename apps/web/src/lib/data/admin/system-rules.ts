import type { AdminStore } from './store';
import type { StorageUsage } from './types';
import type { CommandResult } from './video-commands';
import { pushAudit } from './users-commands';

const fail = (error: string): CommandResult => ({ ok: false, error });

export function retryJob(
  s: AdminStore,
  id: string,
  actorId: string,
  actorName: string,
  now: number,
): CommandResult {
  const job = s.jobs.find((j) => j.id === id);
  if (!job) return fail('That job is already gone.');
  s.jobs = s.jobs.filter((j) => j.id !== id);
  pushAudit(
    s,
    {
      action: 'job.retry',
      targetType: 'job',
      targetId: id,
      summary: `Queued ${job.kind} for ${job.subject} again`,
    },
    actorId,
    actorName,
    now,
  );
  return { ok: true };
}

export function discardJob(
  s: AdminStore,
  id: string,
  reason: string,
  actorId: string,
  actorName: string,
  now: number,
): CommandResult {
  const job = s.jobs.find((j) => j.id === id);
  if (!job) return fail('That job is already gone.');
  if (reason.trim().length < 3) return fail('Write a short reason. It is kept in the audit log.');
  s.jobs = s.jobs.filter((j) => j.id !== id);
  pushAudit(
    s,
    {
      action: 'job.discard',
      targetType: 'job',
      targetId: id,
      summary: `Discarded ${job.kind} for ${job.subject}`,
      after: { reason: reason.trim().slice(0, 200) },
    },
    actorId,
    actorName,
    now,
  );
  return { ok: true };
}

export const STORAGE_LABELS: Record<StorageUsage['type'], string> = {
  video: 'Videos',
  poster: 'Posters',
  caption: 'Captions',
  other: 'Other',
};

export function storageShares(usage: StorageUsage[]) {
  const total = usage.reduce((n, u) => n + u.bytes, 0);
  return [...usage]
    .sort((a, b) => b.bytes - a.bytes)
    .map((u) => ({
      ...u,
      label: STORAGE_LABELS[u.type],
      percent: total > 0 ? (u.bytes / total) * 100 : 0,
    }));
}

/** Warn when usage, or the next 30 days at the recent pace, reaches this share of the budget (M22-S03). */
export const STORAGE_WARN_PERCENT = 80;

export interface StorageBudget {
  usedBytes: number;
  capBytes: number;
  estimateBytes: number;
  usedPercent: number;
  estimatePercent: number;
  status: 'ok' | 'warning' | 'over';
}

/**
 * The monthly estimate is what is stored now plus what was added in the last 30 days. A budget that is
 * missing or not positive never warns, so a settings mistake cannot raise a false alarm.
 */
export function storageBudget(input: {
  usedBytes: number;
  growth30Bytes: number;
  capBytes: number;
}): StorageBudget {
  const used = Math.max(0, input.usedBytes);
  const estimate = used + Math.max(0, input.growth30Bytes);
  const valid = Number.isFinite(input.capBytes) && input.capBytes > 0;
  const percent = (bytes: number) => (valid ? (bytes / input.capBytes) * 100 : 0);
  const usedPercent = percent(used);
  const estimatePercent = percent(estimate);
  const status: StorageBudget['status'] =
    usedPercent >= 100
      ? 'over'
      : usedPercent >= STORAGE_WARN_PERCENT || estimatePercent >= STORAGE_WARN_PERCENT
        ? 'warning'
        : 'ok';
  return {
    usedBytes: used,
    capBytes: valid ? input.capBytes : 0,
    estimateBytes: estimate,
    usedPercent,
    estimatePercent,
    status,
  };
}

export interface Quality {
  startupP50Ms: number | null;
  startupP75Ms: number | null;
  rebufferRatio: number;
  errorsByCode: Array<{ code: string; count: number }>;
  vitalsP75: Record<string, number | null>;
}
type Verdict = { tone: 'success' | 'warning' | 'danger' | 'neutral'; label: string };

/** Plain words for the numbers. Thresholds follow the player budgets in DESIGN-SYSTEM section 13. */
export function qualityVerdicts(q: Quality): { startup: Verdict; rebuffer: Verdict } {
  const startup: Verdict =
    q.startupP75Ms === null
      ? { tone: 'neutral', label: 'No data yet' }
      : q.startupP75Ms <= 3000
        ? { tone: 'success', label: 'Good' }
        : q.startupP75Ms <= 5000
          ? { tone: 'warning', label: 'Slow' }
          : { tone: 'danger', label: 'Too slow' };
  const rebuffer: Verdict =
    q.rebufferRatio <= 0.01
      ? { tone: 'success', label: 'Good' }
      : q.rebufferRatio <= 0.03
        ? { tone: 'warning', label: 'Some stalling' }
        : { tone: 'danger', label: 'Too much stalling' };
  return { startup, rebuffer };
}

export function fixtureQuality(): Quality {
  return {
    startupP50Ms: 1400,
    startupP75Ms: 2600,
    rebufferRatio: 0.012,
    errorsByCode: [
      { code: 'MEDIA_NETWORK', count: 31 },
      { code: 'MEDIA_DECODE', count: 4 },
    ],
    vitalsP75: { LCP: 2300, INP: 160, CLS: 0.05, FCP: 1500, TTFB: 600 },
  };
}

export function seedSystem(now: number): { jobs: AdminStore['jobs']; storage: StorageUsage[] } {
  const ago = (h: number) => new Date(now - h * 3_600_000).toISOString();
  return {
    jobs: [
      {
        id: 'job_1',
        kind: 'encode',
        state: 'failed',
        subject: 'Reading Made Easy, lesson 3',
        attempts: 2,
        maxAttempts: 5,
        lastError: 'The video file ended early.',
        failedAt: ago(3),
      },
      {
        id: 'job_2',
        kind: 'captions',
        state: 'dead',
        subject: 'Safe Water at Home',
        attempts: 5,
        maxAttempts: 5,
        lastError: 'The speech service did not answer.',
        failedAt: ago(26),
      },
      {
        id: 'job_3',
        kind: 'email',
        state: 'failed',
        subject: 'Invite to sade@example.test',
        attempts: 1,
        maxAttempts: 5,
        lastError: 'The mail service refused the message.',
        failedAt: ago(1),
      },
    ],
    storage: [
      { type: 'video', bytes: 412 * 1024 ** 3, files: 186 },
      { type: 'poster', bytes: 3.1 * 1024 ** 3, files: 910 },
      { type: 'caption', bytes: 0.2 * 1024 ** 3, files: 186 },
      { type: 'other', bytes: 1.4 * 1024 ** 3, files: 52 },
    ],
  };
}
