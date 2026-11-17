import { SW_URL } from './constants';

interface WorkerLike {
  postMessage(message: unknown): void;
}
interface RegistrationLike {
  waiting: WorkerLike | null;
  installing: { state: string; addEventListener(type: string, fn: () => void): void } | null;
  addEventListener(type: string, fn: () => void): void;
}
export interface ServiceWorkerContainerLike {
  controller: unknown;
  register(
    url: string,
    options: { scope: string; updateViaCache: 'none' },
  ): Promise<RegistrationLike>;
  addEventListener(type: 'controllerchange', fn: () => void): void;
}

export interface RegisterOptions {
  serviceWorker: ServiceWorkerContainerLike | undefined;
  /** True while a video is playing. An update is never applied then (M25-S02 AC2). */
  isPlaying(): boolean;
  /** Called once a new version has taken over, for the small "Updated" notice. */
  onUpdated(): void;
}

export interface RegisterHandle {
  /** Applies a waiting update if nothing is playing. Call it on navigation or when the page is hidden. */
  applyUpdateIfSafe(): void;
}

export async function registerServiceWorker(
  options: RegisterOptions,
): Promise<RegisterHandle | null> {
  const container = options.serviceWorker;
  if (!container) return null;
  const hadController = Boolean(container.controller);
  let registration: RegistrationLike;
  try {
    registration = await container.register(SW_URL, { scope: '/', updateViaCache: 'none' });
  } catch {
    return null;
  }

  const apply = () => {
    if (registration.waiting && !options.isPlaying())
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
  };
  // A replaced worker announces itself. The very first install does not.
  container.addEventListener('controllerchange', () => {
    if (hadController) options.onUpdated();
  });
  registration.addEventListener('updatefound', () => {
    const worker = registration.installing;
    worker?.addEventListener('statechange', () => {
      if (worker.state === 'installed') apply();
    });
  });
  apply();
  return { applyUpdateIfSafe: apply };
}
