import type { Database } from '@ad/db';
import { sql } from 'drizzle-orm';

export interface LockoutPolicy {
  maxFailures: number;
  windowSeconds: number;
  lockSeconds: number;
}

export interface LockoutState {
  failures: number;
  locked: boolean;
  /** True only for the failure that started the lock, so the owner is mailed once. */
  justLocked: boolean;
  /** Seconds left on the lock, rounded up. Zero when not locked. */
  retryAfterSeconds: number;
}

interface LockoutRow extends Record<string, unknown> {
  failures: number;
  window_started_at: Date;
  locked_until: Date | null;
}

export interface LockoutOptions {
  clock?: () => Date;
}

/**
 * Failure counters with a temporary lock (M01-S07, M12-S01). Keys are opaque (for example `acct:<hex of the
 * email hash>`), so a lock behaves the same whether or not the address has an account.
 */
export class LockoutStore {
  private readonly clock: () => Date;

  constructor(
    private readonly db: Database,
    options: LockoutOptions = {},
  ) {
    this.clock = options.clock ?? (() => new Date());
  }

  /** With a policy, `failures` also counts unlocked failures still inside the window (for tries left prompts). */
  async status(key: string, policy?: LockoutPolicy): Promise<LockoutState> {
    const now = this.clock();
    const result = await this.db.execute<LockoutRow>(
      sql`SELECT failures, window_started_at, locked_until FROM auth_lockouts WHERE key = ${key}`,
    );
    const row = result.rows[0];
    const remaining = row?.locked_until ? secondsUntil(row.locked_until, now) : 0;
    const inWindow =
      policy !== undefined &&
      row !== undefined &&
      (now.getTime() - new Date(row.window_started_at).getTime()) / 1000 < policy.windowSeconds;
    return {
      failures: remaining > 0 || inWindow ? Number(row?.failures ?? 0) : 0,
      locked: remaining > 0,
      justLocked: false,
      retryAfterSeconds: remaining,
    };
  }

  async registerFailure(key: string, policy: LockoutPolicy): Promise<LockoutState> {
    const now = this.clock();
    const iso = now.toISOString();
    return this.db.transaction(async (tx) => {
      await tx.execute(
        sql`INSERT INTO auth_lockouts (key, failures, window_started_at, updated_at)
            VALUES (${key}, 0, ${iso}::timestamptz, ${iso}::timestamptz)
            ON CONFLICT (key) DO NOTHING`,
      );
      const locked = await tx.execute<LockoutRow>(
        sql`SELECT failures, window_started_at, locked_until FROM auth_lockouts WHERE key = ${key} FOR UPDATE`,
      );
      const row = locked.rows[0];
      if (!row) throw new Error('lockout row vanished');

      const activeLock = row.locked_until ? secondsUntil(row.locked_until, now) : 0;
      if (activeLock > 0) {
        return {
          failures: Number(row.failures),
          locked: true,
          justLocked: false,
          retryAfterSeconds: activeLock,
        };
      }
      const windowAge = (now.getTime() - new Date(row.window_started_at).getTime()) / 1000;
      const stale = row.locked_until !== null || windowAge >= policy.windowSeconds;
      const failures = (stale ? 0 : Number(row.failures)) + 1;
      const windowStart = stale ? now : new Date(row.window_started_at);
      const lockedUntil =
        failures >= policy.maxFailures ? new Date(now.getTime() + policy.lockSeconds * 1000) : null;
      await tx.execute(
        sql`UPDATE auth_lockouts
            SET failures = ${failures}, window_started_at = ${windowStart.toISOString()}::timestamptz,
                locked_until = ${lockedUntil ? lockedUntil.toISOString() : null}::timestamptz,
                updated_at = ${iso}::timestamptz
            WHERE key = ${key}`,
      );
      return {
        failures,
        locked: lockedUntil !== null,
        justLocked: lockedUntil !== null,
        retryAfterSeconds: lockedUntil ? policy.lockSeconds : 0,
      };
    });
  }

  async clear(key: string): Promise<void> {
    await this.db.execute(sql`DELETE FROM auth_lockouts WHERE key = ${key}`);
  }
}

function secondsUntil(target: Date, now: Date): number {
  const ms = new Date(target).getTime() - now.getTime();
  return ms > 0 ? Math.ceil(ms / 1000) : 0;
}
