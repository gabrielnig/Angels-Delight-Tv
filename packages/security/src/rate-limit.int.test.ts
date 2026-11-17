import { RateLimited } from '@ad/shared';
import { createTestDatabase, integrationEnabled, type TestDatabase } from '@ad/db/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { LimiterUnavailable, RateLimiter } from './rate-limit';

const policy = { name: 'test-login', capacity: 3, refillPerSecond: 1 / 60 };

describe.skipIf(!integrationEnabled())('RateLimiter', () => {
  let database: TestDatabase;
  let now = new Date('2026-01-01T00:00:00Z');
  const clock = () => now;
  const at = (seconds: number) => {
    now = new Date(new Date('2026-01-01T00:00:00Z').getTime() + seconds * 1000);
  };

  beforeAll(async () => {
    database = await createTestDatabase();
  });
  afterAll(async () => {
    await database.drop();
  });

  it('allows up to the capacity and then denies with a wait time', async () => {
    at(0);
    const limiter = new RateLimiter(database.db, { clock });
    const results = [];
    for (let i = 0; i < 4; i++) results.push(await limiter.consume(policy, 'ip-a'));
    expect(results.map((r) => r.allowed)).toEqual([true, true, true, false]);
    expect(results[3]?.retryAfterSeconds).toBe(60);
  });

  it('refills over time so a denied caller can try again', async () => {
    at(0);
    const limiter = new RateLimiter(database.db, { clock });
    for (let i = 0; i < 3; i++) await limiter.consume(policy, 'ip-b');
    expect((await limiter.consume(policy, 'ip-b')).allowed).toBe(false);
    at(61);
    expect((await limiter.consume(policy, 'ip-b')).allowed).toBe(true);
  });

  it('keeps subjects and policies apart', async () => {
    at(0);
    const limiter = new RateLimiter(database.db, { clock });
    for (let i = 0; i < 3; i++) await limiter.consume(policy, 'ip-c');
    expect((await limiter.consume(policy, 'ip-d')).allowed).toBe(true);
    expect((await limiter.consume({ ...policy, name: 'other' }, 'ip-c')).allowed).toBe(true);
  });

  it('does not spend tokens when a request is denied', async () => {
    at(0);
    const limiter = new RateLimiter(database.db, { clock });
    for (let i = 0; i < 10; i++) await limiter.consume(policy, 'ip-e');
    at(60);
    expect((await limiter.consume(policy, 'ip-e')).allowed).toBe(true);
  });

  it('peek reports the state without spending a token', async () => {
    at(0);
    const limiter = new RateLimiter(database.db, { clock });
    for (let i = 0; i < 3; i++) await limiter.consume(policy, 'ip-f');
    expect((await limiter.peek(policy, 'ip-f')).allowed).toBe(false);
    expect((await limiter.peek(policy, 'ip-f')).allowed).toBe(false);
    at(60);
    expect((await limiter.peek(policy, 'ip-f')).allowed).toBe(true);
    expect((await limiter.peek(policy, 'ip-f')).allowed).toBe(true);
  });

  it('never grants more than the capacity under concurrent requests', async () => {
    at(0);
    const limiter = new RateLimiter(database.db, { clock });
    const results = await Promise.all(
      Array.from({ length: 12 }, () => limiter.consume(policy, 'ip-g')),
    );
    expect(results.filter((r) => r.allowed)).toHaveLength(3);
  });

  it('enforce throws RateLimited with the wait time', async () => {
    at(0);
    const limiter = new RateLimiter(database.db, { clock });
    for (let i = 0; i < 3; i++) await limiter.enforce(policy, 'ip-h');
    await expect(limiter.enforce(policy, 'ip-h')).rejects.toMatchObject({
      constructor: RateLimited,
      retryAfterSeconds: 60,
    });
  });

  it('fails closed when the store is unreachable and the route is an auth route', async () => {
    const broken = new RateLimiter(
      { transaction: () => Promise.reject(new Error('connection refused')) } as never,
      { clock },
    );
    await expect(broken.enforce(policy, 'x', { onStoreError: 'closed' })).rejects.toBeInstanceOf(
      LimiterUnavailable,
    );
  });

  it('fails open for read routes and reports the error to the logger', async () => {
    const errors: unknown[] = [];
    const broken = new RateLimiter(
      { transaction: () => Promise.reject(new Error('connection refused')) } as never,
      { clock, onError: (error) => errors.push(error) },
    );
    await expect(broken.enforce(policy, 'x', { onStoreError: 'open' })).resolves.toMatchObject({
      allowed: true,
    });
    expect(errors).toHaveLength(1);
  });

  it('removes buckets that have been idle for a long time', async () => {
    at(0);
    const limiter = new RateLimiter(database.db, { clock });
    await limiter.consume(policy, 'ip-old');
    at(86_400 * 3);
    const removed = await limiter.pruneIdle(86_400);
    expect(removed).toBeGreaterThanOrEqual(1);
  });
});
