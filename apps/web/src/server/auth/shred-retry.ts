export interface ShredRetryOptions {
  /** Finishes every pending key destruction, for example `AccountService.destroyPendingKeys`. */
  run(): Promise<number>;
  intervalMs: number;
  logger: { error(message: string, fields?: Record<string, unknown>): void };
}

/**
 * The retry job that guarantees a deleted account's key is destroyed (SECURITY.md section 10). It runs in the web
 * process because only web can read `account_deletions` and reach the keys database. Safe to run in many
 * instances: destruction is idempotent. Returns a function that stops it.
 */
export function startShredRetry(options: ShredRetryOptions): () => void {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await options.run();
    } catch (error) {
      options.logger.error('key destruction retry failed', { error: String(error) });
    } finally {
      running = false;
    }
  };
  void tick();
  const timer = setInterval(() => void tick(), options.intervalMs);
  timer.unref?.();
  return () => clearInterval(timer);
}

/**
 * One tick of the account deletion job (M02-S06, M32-S03): purge every account whose grace period is over, then
 * destroy any key still left. The key step runs even when the purge fails, and the failure is still raised.
 */
export async function runDeletionJobs(service: {
  purgeDueDeletions(): Promise<number>;
  destroyPendingKeys(): Promise<number>;
}): Promise<number> {
  let purged = 0;
  let failure: unknown = null;
  try {
    purged = await service.purgeDueDeletions();
  } catch (error) {
    failure = error;
  }
  const shredded = await service.destroyPendingKeys();
  if (failure) throw failure;
  return purged + shredded;
}
