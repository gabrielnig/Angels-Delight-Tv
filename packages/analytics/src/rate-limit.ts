export interface BucketPolicy {
  /** Part of the bucket key, so two policies never share a counter. */
  name: string;
  capacity: number;
  refillPerSecond: number;
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

/**
 * Structurally the same as `RateLimiter` in `@ad/security`, so the route passes that one in.
 * Subjects are opaque (a truncated IP or a profile id), never raw addresses.
 */
export interface RateLimiter {
  consume(policy: BucketPolicy, subject: string): Promise<RateLimitResult>;
}

/** Ingest limits, tunable here (docs/SECURITY.md section 7). Per batch, not per event. */
export const ANALYTICS_LIMITS = {
  perIp: { name: 'analytics-ip', capacity: 120, refillPerSecond: 1 } satisfies BucketPolicy,
  /** Sponsor impressions are counted per event, so they get their own bucket (M48). */
  sponsorPerIp: { name: 'analytics-sponsor-ip', capacity: 30, refillPerSecond: 0.2 } satisfies BucketPolicy,
  perProfile: {
    name: 'analytics-profile',
    capacity: 60,
    refillPerSecond: 0.5,
  } satisfies BucketPolicy,
};

/** In memory limiter for tests and local development. */
export function createMemoryRateLimiter(now: () => number = Date.now): RateLimiter {
  const buckets = new Map<string, { tokens: number; at: number }>();
  return {
    async consume(policy, subject) {
      const key = `${policy.name}:${subject}`;
      const current = buckets.get(key);
      const refilled = current
        ? Math.min(
            policy.capacity,
            current.tokens + ((now() - current.at) / 1000) * policy.refillPerSecond,
          )
        : policy.capacity;
      if (refilled < 1) {
        buckets.set(key, { tokens: refilled, at: now() });
        return {
          allowed: false,
          retryAfterSeconds: Math.max(1, Math.ceil((1 - refilled) / policy.refillPerSecond)),
        };
      }
      buckets.set(key, { tokens: refilled - 1, at: now() });
      return { allowed: true, retryAfterSeconds: 0 };
    },
  };
}
