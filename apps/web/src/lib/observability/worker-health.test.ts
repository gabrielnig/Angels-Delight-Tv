import { describe, expect, it } from 'vitest';
import { workerHealthResponse } from './worker-health';

const now = new Date('2026-01-01T12:00:00Z');

describe('worker health (M24-S02 AC2)', () => {
  it('answers 200 while the worker reports in', async () => {
    const res = await workerHealthResponse(async () => new Date(now.getTime() - 90_000), now);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, ageSeconds: 90 });
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('answers 503 after 5 minutes of silence', async () => {
    const res = await workerHealthResponse(async () => new Date(now.getTime() - 301_000), now);
    expect(res.status).toBe(503);
    expect((await res.json()).ok).toBe(false);
  });

  it('answers 503 when the worker never reported or the database cannot be read', async () => {
    expect((await workerHealthResponse(async () => null, now)).status).toBe(503);
    const failing = await workerHealthResponse(async () => {
      throw new Error('db down');
    }, now);
    expect(failing.status).toBe(503);
    expect(JSON.stringify(await failing.json())).not.toContain('db down');
  });
});
