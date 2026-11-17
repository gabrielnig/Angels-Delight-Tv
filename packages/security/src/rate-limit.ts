import type { Database } from '@ad/db';
import { RateLimited } from '@ad/shared';
import { sql } from 'drizzle-orm';

export interface BucketPolicy {
  /** Part of the bucket key, so two policies never share a counter. */
  name: string;
  capacity: number;
  /** Tokens added per second. capacity divided by the window length in seconds. */
  refillPerSecond: number;
}

export interface LimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

/** Thrown when the limiter store fails on a route that must fail closed (M23-S03 AC2). */
export class LimiterUnavailable extends Error {
  constructor(options?: { cause?: unknown }) {
    super('Rate limit store unavailable', options);
    this.name = 'LimiterUnavailable';
  }
}

export interface RateLimiterOptions {
  clock?: () => Date;
  onError?: (error: unknown) => void;
}

export interface EnforceOptions {
  cost?: number;
  /** auth routes use closed, read routes use open. */
  onStoreError?: 'closed' | 'open';
}

interface BucketRow extends Record<string, unknown> {
  tokens: number;
  updated_at: Date;
}

/**
 * Token buckets in Postgres (`rate_limit_buckets`). Each consume runs in one transaction that locks the row,
 * refills it from the elapsed time, and spends only when enough tokens exist, so concurrent callers cannot
 * overspend. Subjects must already be opaque (an ip, or a hash of an email), never a raw address.
 */
export class RateLimiter {
  private readonly clock: () => Date;
  private readonly onError: (error: unknown) => void;

  constructor(
    private readonly db: Database,
    options: RateLimiterOptions = {},
  ) {
    this.clock = options.clock ?? (() => new Date());
    this.onError = options.onError ?? (() => undefined);
  }

  consume(policy: BucketPolicy, subject: string, cost = 1): Promise<LimitResult> {
    return this.run(policy, subject, cost, true);
  }

  peek(policy: BucketPolicy, subject: string, cost = 1): Promise<LimitResult> {
    return this.run(policy, subject, cost, false);
  }

  /** Consumes and throws RateLimited when denied. Store failures follow `onStoreError` (default closed). */
  async enforce(
    policy: BucketPolicy,
    subject: string,
    options: EnforceOptions = {},
  ): Promise<LimitResult> {
    let result: LimitResult;
    try {
      result = await this.consume(policy, subject, options.cost ?? 1);
    } catch (error) {
      this.onError(error);
      if ((options.onStoreError ?? 'closed') === 'closed')
        throw new LimiterUnavailable({ cause: error });
      return { allowed: true, remaining: policy.capacity, retryAfterSeconds: 0 };
    }
    if (!result.allowed) throw new RateLimited(result.retryAfterSeconds);
    return result;
  }

  async pruneIdle(olderThanSeconds: number): Promise<number> {
    const cutoff = new Date(this.clock().getTime() - olderThanSeconds * 1000);
    const result = await this.db.execute(
      sql`DELETE FROM rate_limit_buckets WHERE updated_at < ${cutoff.toISOString()}::timestamptz`,
    );
    return result.rowCount ?? 0;
  }

  private async run(
    policy: BucketPolicy,
    subject: string,
    cost: number,
    spend: boolean,
  ): Promise<LimitResult> {
    const key = `${policy.name}:${subject}`;
    const now = this.clock();
    return this.db.transaction(async (tx) => {
      await tx.execute(
        sql`INSERT INTO rate_limit_buckets (key, tokens, updated_at)
            VALUES (${key}, ${policy.capacity}, ${now.toISOString()}::timestamptz)
            ON CONFLICT (key) DO NOTHING`,
      );
      const locked = await tx.execute<BucketRow>(
        sql`SELECT tokens, updated_at FROM rate_limit_buckets WHERE key = ${key} FOR UPDATE`,
      );
      const row = locked.rows[0];
      if (!row) throw new Error('rate limit bucket vanished');
      const elapsed = Math.max(0, (now.getTime() - new Date(row.updated_at).getTime()) / 1000);
      const refilled = Math.min(
        policy.capacity,
        Number(row.tokens) + elapsed * policy.refillPerSecond,
      );
      const allowed = refilled >= cost - 1e-9;
      const tokens = allowed && spend ? refilled - cost : refilled;
      if (spend || elapsed > 0) {
        await tx.execute(
          sql`UPDATE rate_limit_buckets SET tokens = ${tokens}, updated_at = ${now.toISOString()}::timestamptz WHERE key = ${key}`,
        );
      }
      return {
        allowed,
        remaining: Math.max(0, Math.floor(tokens)),
        retryAfterSeconds: allowed ? 0 : Math.ceil((cost - refilled) / policy.refillPerSecond),
      };
    });
  }
}
