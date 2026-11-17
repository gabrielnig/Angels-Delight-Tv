import { describe, expect, it } from 'vitest';
import { runReadiness } from './ready';

describe('runReadiness', () => {
  it('is ready when every check passes', async () => {
    const result = await runReadiness({
      database: async () => {},
      storage: async () => {},
      queue: async () => {},
    });
    expect(result.ok).toBe(true);
    expect(Object.keys(result.checks)).toEqual(['database', 'storage', 'queue']);
    expect(result.checks.database).toMatchObject({ ok: true });
  });

  it('is not ready when one fails, and never leaks the error text', async () => {
    const result = await runReadiness({
      database: async () => {
        throw new Error('password authentication failed for user ad_app at 10.0.0.5');
      },
      storage: async () => {},
    });
    expect(result.ok).toBe(false);
    expect(result.checks.database).toEqual({ ok: false, ms: expect.any(Number) });
    expect(JSON.stringify(result)).not.toContain('10.0.0.5');
    expect(result.checks.storage).toMatchObject({ ok: true });
  });

  it('times out a hanging check', async () => {
    const result = await runReadiness({ database: () => new Promise(() => {}) }, { timeoutMs: 30 });
    expect(result.ok).toBe(false);
    expect(result.checks.database!.ok).toBe(false);
  });

  it('runs the checks in parallel', async () => {
    const slow = () => new Promise<void>((r) => setTimeout(r, 40));
    const started = Date.now();
    await runReadiness({ a: slow, b: slow, c: slow });
    expect(Date.now() - started).toBeLessThan(110);
  });
});
