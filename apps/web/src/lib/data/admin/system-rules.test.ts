import { describe, expect, it } from 'vitest';
import {
  STORAGE_WARN_PERCENT,
  discardJob,
  qualityVerdicts,
  retryJob,
  storageBudget,
  storageShares,
} from './system-rules';
import { getStore } from './store';

const fresh = () => structuredClone(getStore());
const NOW = Date.parse('2026-11-17T10:00:00Z');

describe('jobs', () => {
  it('retry requeues a failed job and audits it', () => {
    const s = fresh();
    const job = s.jobs.find((j) => j.state === 'failed')!;
    expect(retryJob(s, job.id, 'a1', 'Chi', NOW).ok).toBe(true);
    expect(s.jobs.some((j) => j.id === job.id)).toBe(false);
    expect(s.audit[0]).toMatchObject({ action: 'job.retry', targetId: job.id });
  });
  it('discard needs a reason, retry of unknown job fails', () => {
    const s = fresh();
    const job = s.jobs[0]!;
    expect(discardJob(s, job.id, '', 'a1', 'Chi', NOW).ok).toBe(false);
    expect(discardJob(s, job.id, 'Source file was deleted', 'a1', 'Chi', NOW).ok).toBe(true);
    expect(retryJob(s, 'nope', 'a1', 'Chi', NOW).ok).toBe(false);
  });
});

describe('storage', () => {
  it('shares add to 100 and the biggest comes first', () => {
    const shares = storageShares(fresh().storage);
    expect(shares[0]!.percent).toBeGreaterThanOrEqual(shares.at(-1)!.percent);
    expect(Math.round(shares.reduce((n, r) => n + r.percent, 0))).toBe(100);
  });
  it('is safe with no storage', () => {
    expect(storageShares([])).toEqual([]);
  });
});

describe('quality verdicts', () => {
  it('rates startup, rebuffering and errors in words', () => {
    const v = qualityVerdicts({
      startupP50Ms: 1200,
      startupP75Ms: 2000,
      rebufferRatio: 0.004,
      errorsByCode: [],
      vitalsP75: {},
    });
    expect(v.startup).toEqual({ tone: 'success', label: 'Good' });
    expect(v.rebuffer.label).toBe('Good');
    const bad = qualityVerdicts({
      startupP50Ms: 4000,
      startupP75Ms: 6500,
      rebufferRatio: 0.05,
      errorsByCode: [],
      vitalsP75: {},
    });
    expect(bad.startup.tone).toBe('danger');
    expect(bad.rebuffer.tone).toBe('danger');
  });
  it('handles no data', () => {
    expect(
      qualityVerdicts({
        startupP50Ms: null,
        startupP75Ms: null,
        rebufferRatio: 0,
        errorsByCode: [],
        vitalsP75: {},
      }).startup.label,
    ).toBe('No data yet');
  });
});

describe('storage budget and monthly estimate (M22-S03)', () => {
  const GB = 1024 ** 3;
  it('warns at 80 percent of the budget, not before', () => {
    expect(STORAGE_WARN_PERCENT).toBe(80);
    const at = (used: number) =>
      storageBudget({ usedBytes: used, growth30Bytes: 0, capBytes: 100 * GB }).status;
    expect(at(79 * GB)).toBe('ok');
    expect(at(80 * GB)).toBe('warning');
    expect(at(99 * GB)).toBe('warning');
    expect(at(100 * GB)).toBe('over');
    expect(at(150 * GB)).toBe('over');
  });
  it('estimates the next 30 days from the last 30 days of growth', () => {
    const b = storageBudget({ usedBytes: 50 * GB, growth30Bytes: 20 * GB, capBytes: 100 * GB });
    expect(b.estimateBytes).toBe(70 * GB);
    expect(b.usedPercent).toBe(50);
    expect(b.estimatePercent).toBe(70);
    expect(b.status).toBe('ok');
  });
  it('warns when the estimate crosses 80 percent even if usage has not', () => {
    const b = storageBudget({ usedBytes: 70 * GB, growth30Bytes: 15 * GB, capBytes: 100 * GB });
    expect(b.usedPercent).toBe(70);
    expect(b.estimatePercent).toBe(85);
    expect(b.status).toBe('warning');
  });
  it('has a zero state and survives a bad budget', () => {
    const zero = storageBudget({ usedBytes: 0, growth30Bytes: 0, capBytes: 100 * GB });
    expect(zero).toMatchObject({ estimateBytes: 0, usedPercent: 0, status: 'ok' });
    const bad = storageBudget({ usedBytes: 5, growth30Bytes: 5, capBytes: 0 });
    expect(bad.status).toBe('ok');
    expect(Number.isFinite(bad.usedPercent)).toBe(true);
  });
});
