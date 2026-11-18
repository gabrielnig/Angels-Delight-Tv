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

/** Next calls this for errors in pages, layouts and server actions (M24-S03). Route handlers report through withRequest. */
export async function onRequestError(
  error: unknown,
  request: { path: string; method: string; headers: Record<string, string | string[] | undefined> },
  context: { routePath: string; routeType: string; routerKind: string },
): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  try {
    const { reportRequestError } = await import('./lib/observability/request-error');
    const { getServices } = await import('./lib/runtime/services');
    const { reporter, logger } = getServices();
    reportRequestError(error, request, context, { reporter, logger });
  } catch {
    // Missing configuration or a tracker outage is ignored silently (M24-S03 Error).
  }
}
