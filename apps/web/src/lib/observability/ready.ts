import { sql } from 'drizzle-orm';

export type Check = () => Promise<unknown>;

export interface CheckResult {
  ok: boolean;
  ms: number;
}

export interface ReadinessResult {
  ok: boolean;
  checks: Record<string, CheckResult>;
}

/** Runs every check in parallel with a timeout. Failures report only `ok: false`, never the error text. */
export async function runReadiness(
  checks: Record<string, Check>,
  options: { timeoutMs?: number } = {},
): Promise<ReadinessResult> {
  const timeoutMs = options.timeoutMs ?? 2000;
  const entries = await Promise.all(
    Object.entries(checks).map(async ([name, check]): Promise<[string, CheckResult]> => {
      const started = Date.now();
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([
          check(),
          new Promise((_, reject) => {
            timer = setTimeout(() => reject(new Error('timeout')), timeoutMs);
          }),
        ]);
        return [name, { ok: true, ms: Date.now() - started }];
      } catch {
        return [name, { ok: false, ms: Date.now() - started }];
      } finally {
        if (timer) clearTimeout(timer);
      }
    }),
  );
  const result = Object.fromEntries(entries);
  return { ok: entries.every(([, r]) => r.ok), checks: result };
}

interface Executor {
  execute(query: ReturnType<typeof sql>): PromiseLike<unknown>;
}

export const databaseCheck =
  (db: Executor): Check =>
  async () => {
    await db.execute(sql`SELECT 1`);
  };

/** The queue is ready when the pg-boss schema exists and can be read by the web role. */
export const queueCheck =
  (db: Executor): Check =>
  async () => {
    const result = (await db.execute(sql`SELECT to_regclass('pgboss.job') AS t`)) as {
      rows?: Array<{ t: unknown }>;
    };
    if (!result.rows?.[0]?.t) throw new Error('queue schema missing');
  };

/** A head request for a key that never exists: proves the bucket is reachable and the credentials work. */
export const storageCheck =
  (storage: { head(key: string): Promise<unknown> }): Check =>
  async () => {
    await storage.head('healthcheck/none');
  };
