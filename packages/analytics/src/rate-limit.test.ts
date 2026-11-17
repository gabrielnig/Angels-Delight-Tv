import { describe, expect, it } from 'vitest';
import { createMemoryRateLimiter, type BucketPolicy } from './rate-limit';

const policy: BucketPolicy = { capacity: 3, refillPerSecond: 1 };

describe('memory rate limiter', () => {
  it('allows up to capacity then denies with a retry hint', async () => {
    let now = 0;
    const limiter = createMemoryRateLimiter(() => now);
    for (let i = 0; i < 3; i += 1) expect((await limiter.consume('k', policy)).allowed).toBe(true);
    const denied = await limiter.consume('k', policy);
    expect(denied.allowed).toBe(false);
    expect(denied.retryAfterSeconds).toBeGreaterThanOrEqual(1);
    now += 5000;
    expect((await limiter.consume('k', policy)).allowed).toBe(true);
  });

  it('keeps keys independent', async () => {
    const limiter = createMemoryRateLimiter(() => 0);
    for (let i = 0; i < 3; i += 1) await limiter.consume('a', policy);
    expect((await limiter.consume('b', policy)).allowed).toBe(true);
  });
});
