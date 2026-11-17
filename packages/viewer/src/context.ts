import type { Database } from '@ad/db';
import type { CatalogContext } from '@ad/catalog';
import { DEFAULT_RULES, type ViewerRules } from './rules';

/** Seals profile names with the account's own key. Lane B supplies the per user key implementation. */
export interface NameCipher {
  seal(accountId: string, name: string): Promise<Uint8Array>;
  open(accountId: string, sealed: Uint8Array): Promise<string>;
}

/** Everything the viewer services need besides the actor. Built once at startup, passed to every service call. */
export interface ViewerContext {
  db: Database;
  /** Public base url of the media bucket, used to build artwork urls. */
  mediaOrigin: string;
  nameCipher: NameCipher;
  /** Checks the account password. The auth lane owns hashing and its lockout rules. */
  verifyPassword(accountId: string, password: string): Promise<boolean>;
  /** Consumes one attempt from a bucket and says whether it was allowed. Absent in tests and early dev. */
  rateLimit?: (key: string) => Promise<boolean>;
  now?: () => Date;
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
