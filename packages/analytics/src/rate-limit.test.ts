import { describe, expect, it } from 'vitest';
import { createMemoryRateLimiter, type BucketPolicy } from './rate-limit';

const policy: BucketPolicy = { name: 'p', capacity: 3, refillPerSecond: 1 };

describe('memory rate limiter', () => {
  it('allows up to capacity then denies with a retry hint', async () => {
    let now = 0;
    const limiter = createMemoryRateLimiter(() => now);
    for (let i = 0; i < 3; i += 1) expect((await limiter.consume(policy, 'k')).allowed).toBe(true);
    const denied = await limiter.consume(policy, 'k');
    expect(denied.allowed).toBe(false);
    expect(denied.retryAfterSeconds).toBeGreaterThanOrEqual(1);
    now += 5000;
    expect((await limiter.consume(policy, 'k')).allowed).toBe(true);
  });

  it('keeps keys independent', async () => {
    const limiter = createMemoryRateLimiter(() => 0);
    for (let i = 0; i < 3; i += 1) await limiter.consume(policy, 'a');
    expect((await limiter.consume(policy, 'b')).allowed).toBe(true);
  });
});
