export interface WorkerNavigator {
  serviceWorker?: { controller: { postMessage(message: unknown): void } | null };
}

/**
 * Clears the caches of the service worker when the profile or the account changes (M03-S07, M03-S14).
 * Returns false when nothing could be told, so the caller can fall back to a full reload.
 */
export function clearServiceWorkerCaches(nav: WorkerNavigator): boolean {
  const controller = nav.serviceWorker?.controller;
  if (!controller) return false;
  try {
    controller.postMessage({ type: 'CLEAR_CACHES' });
    return true;
  } catch {
    return false;
  }
}
