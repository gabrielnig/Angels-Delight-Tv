import type { Database } from '@ad/db';
import { workerHeartbeats } from '@ad/db';
import { eq, sql } from 'drizzle-orm';

/** The worker is reported down after this long without a beat (M24-S02 AC2). */
export const WORKER_STALE_SECONDS = 300;

export interface HeartbeatStore {
  beat(name: string): Promise<void>;
  last(name: string): Promise<Date | null>;
}

export class DrizzleHeartbeatStore implements HeartbeatStore {
  constructor(private readonly db: Database) {}

  async beat(name: string): Promise<void> {
    await this.db
      .insert(workerHeartbeats)
      .values({ name })
      .onConflictDoUpdate({ target: workerHeartbeats.name, set: { beatAt: sql`now()` } });
  }

  async last(name: string): Promise<Date | null> {
    const [row] = await this.db
      .select({ at: workerHeartbeats.beatAt })
      .from(workerHeartbeats)
      .where(eq(workerHeartbeats.name, name));
    return row?.at ?? null;
  }
}

export interface HeartbeatJudgement {
  ok: boolean;
  ageSeconds: number | null;
}

export function judgeHeartbeat(
  last: Date | null,
  now: Date,
  staleSeconds: number = WORKER_STALE_SECONDS,
): HeartbeatJudgement {
  if (!last) return { ok: false, ageSeconds: null };
  const ageSeconds = Math.floor((now.getTime() - last.getTime()) / 1000);
  return { ok: ageSeconds <= staleSeconds, ageSeconds };
}

export interface StartHeartbeatOptions {
  beat: () => Promise<void>;
  intervalMs?: number;
  onError?: (error: unknown) => void;
  schedule?: (fn: () => void, ms: number) => { stop(): void };
}

/** Beats now and every interval. A failed write is reported and never stops the loop or the worker. */
export function startHeartbeat(options: StartHeartbeatOptions): { stop(): void } {
  const run = () => {
    options.beat().catch((error: unknown) => options.onError?.(error));
  };
  const schedule =
    options.schedule ??
    ((fn, ms) => {
      const timer = setInterval(fn, ms);
      timer.unref();
      return { stop: () => clearInterval(timer) };
    });
  run();
  return schedule(run, options.intervalMs ?? 60_000);
}
