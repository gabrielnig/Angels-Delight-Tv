import { sql } from 'drizzle-orm';
import type { SqlExecutor } from './sql';
import { rowsOf } from './sql';

export interface BucketPolicy {
  capacity: number;
  refillPerSecond: number;
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

export interface RateLimiter {
  consume(key: string, policy: BucketPolicy): Promise<RateLimitResult>;
}

/** Ingest limits, tunable here (docs/SECURITY.md section 7). Per batch, not per event. */
export const ANALYTICS_LIMITS = {
  perIp: { capacity: 120, refillPerSecond: 1 } satisfies BucketPolicy,
  perProfile: { capacity: 60, refillPerSecond: 0.5 } satisfies BucketPolicy,
};

export function createMemoryRateLimiter(now: () => number = Date.now): RateLimiter {
  const buckets = new Map<string, { tokens: number; at: number }>();
  return {
    async consume(key, policy) {
      const current = buckets.get(key);
      const refilled = current
        ? Math.min(
            policy.capacity,
            current.tokens + ((now() - current.at) / 1000) * policy.refillPerSecond,
          )
        : policy.capacity;
      const tokens = Math.max(refilled - 1, -policy.capacity);
      buckets.set(key, { tokens, at: now() });
      return result(tokens, policy);
    },
  };
}

function result(tokensAfter: number, policy: BucketPolicy): RateLimitResult {
  if (tokensAfter >= 0) return { allowed: true, retryAfterSeconds: 0 };
  return {
    allowed: false,
    retryAfterSeconds: Math.max(1, Math.ceil((1 - tokensAfter) / policy.refillPerSecond)),
  };
}

/**
 * Postgres token bucket on the UNLOGGED `rate_limit_buckets` table (docs/DATA-MODEL.md 4.9), one atomic statement.
 * Each call subtracts one token. A denied caller goes into debt, so a client that keeps hammering stays denied
 * until its debt refills. `tokens` below zero after the call means denied.
 */
export function createPgRateLimiter(db: SqlExecutor): RateLimiter {
  return {
    async consume(key, policy) {
      const rows = rowsOf<{ tokens: number }>(
        await db.execute(sql`
          INSERT INTO rate_limit_buckets AS b (key, tokens, updated_at)
          VALUES (${key}, ${policy.capacity - 1}, now())
          ON CONFLICT (key) DO UPDATE SET
            tokens = GREATEST(
              LEAST(${policy.capacity}::float8, b.tokens + EXTRACT(EPOCH FROM (now() - b.updated_at)) * ${policy.refillPerSecond}::float8) - 1,
              ${-policy.capacity}::float8
            ),
            updated_at = now()
          RETURNING tokens`),
      );
      return result(Number(rows[0]?.tokens ?? 0), policy);
    },
  };
}
