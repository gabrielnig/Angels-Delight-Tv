import type { Database } from '@ad/db';
import { RateLimited } from '@ad/shared';
import type { CatalogCache, CatalogContext } from '@ad/catalog';
import { DEFAULT_RULES, type ViewerRules } from './rules';

/** Seals profile names with the account's own key. Lane B supplies the per user key implementation. */
export interface NameCipher {
  seal(accountId: string, name: string): Promise<Uint8Array>;
  open(accountId: string, sealed: Uint8Array): Promise<string>;
}

export type ViewerBucket = 'api' | 'progress' | 'search' | 'profile_pin' | 'kids_exit';

export interface RateLimitDecision {
  allowed: boolean;
  retryAfterSeconds: number;
}

export type RateLimitCheck = (bucket: ViewerBucket, subject: string) => Promise<RateLimitDecision>;

/** Defaults from docs/SECURITY.md section 7. The web wiring turns these into token buckets. */
export const VIEWER_RATE_POLICIES: Record<
  ViewerBucket,
  { capacity: number; windowSeconds: number }
> = {
  /** Every signed in viewer API request, per account. SECURITY.md section 7 global API limit. */
  api: { capacity: 300, windowSeconds: 60 },
  progress: { capacity: 30, windowSeconds: 60 },
  search: { capacity: 60, windowSeconds: 60 },
  profile_pin: { capacity: 5, windowSeconds: 900 },
  kids_exit: { capacity: 5, windowSeconds: 900 },
};

/** Everything the viewer services need besides the actor. Built once at startup, passed to every service call. */
/** Runs a catalog read through the shared cache when there is one. Only for reads that do not depend on the viewer. */
export function shared<T>(ctx: ViewerContext, key: unknown[], load: () => Promise<T>): Promise<T> {
  return ctx.catalogCache ? ctx.catalogCache.remember(JSON.stringify(key), load) : load();
}

export interface ViewerContext {
  db: Database;
  /** Public base url of the media bucket, used to build artwork urls. */
  mediaOrigin: string;
  nameCipher: NameCipher;
  /** Checks the account password. The auth lane owns hashing and its lockout rules. */
  verifyPassword(accountId: string, password: string): Promise<boolean>;
  /** Spends one attempt from a bucket (see VIEWER_RATE_POLICIES). Absent means unlimited, which only tests and early dev use. */
  rateLimit?: RateLimitCheck;
  now?: () => Date;
  /** Shared 60 second cache for catalog reads that do not depend on the viewer (M04-S05). Absent means no caching. */
  catalogCache?: CatalogCache;
  rules?: Partial<ViewerRules>;
}

export function catalogContext(ctx: ViewerContext): CatalogContext {
  return { mediaOrigin: ctx.mediaOrigin, now: ctx.now ?? (() => new Date()) };
}

export function rulesOf(ctx: ViewerContext): ViewerRules {
  return { ...DEFAULT_RULES, ...ctx.rules };
}

export function clockOf(ctx: ViewerContext): Date {
  return (ctx.now ?? (() => new Date()))();
}

/** Spends one attempt and throws RateLimited with the wait time when the bucket is empty. */
export async function spendAttempt(
  ctx: ViewerContext,
  bucket: ViewerBucket,
  subject: string,
): Promise<void> {
  if (!ctx.rateLimit) return;
  const decision = await ctx.rateLimit(bucket, subject);
  if (!decision.allowed) throw new RateLimited(decision.retryAfterSeconds);
}
