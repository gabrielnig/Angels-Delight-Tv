/** Starts background work that must not depend on a request arriving. Node runtime only. */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  if (process.env.NODE_ENV !== 'production' || !process.env.KEYS_DATABASE_URL_SHRED) return;
  const { authRuntime } = await import('./server/auth/runtime');
  const { runDeletionJobs, startShredRetry } = await import('./server/auth/shred-retry');
  const runtime = authRuntime();
  const { createLogger } = await import('@ad/shared');
  const logger = createLogger({ bindings: { component: 'shred-retry' } });
  startShredRetry({
    run: () => runDeletionJobs(runtime.staff),
    intervalMs: 15 * 60_000,
    logger,
  });
  // Export jobs (M02-S05): the request kicks one at once, this tick retries and picks up anything left over.
  const { realDataEnabled } = await import('./server/data/mode');
  if (realDataEnabled()) {
    const { exportJobs } = await import('./server/data/real-data');
    startShredRetry({
      run: () => exportJobs().runPending(),
      intervalMs: 2 * 60_000,
      logger: createLogger({ bindings: { component: 'export-jobs' } }),
    });
  }
}
