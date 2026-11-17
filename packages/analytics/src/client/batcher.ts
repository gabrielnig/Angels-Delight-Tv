import { EVENT_SCHEMA_VERSION, type DeviceClass } from '../constants';
import type { AnalyticsEvent } from '../events';

export interface ClientEnv {
  sendBeacon(url: string, data: Blob | string): boolean;
  fetch(
    url: string,
    init: { method: 'POST'; body: string; keepalive?: boolean; headers: Record<string, string> },
  ): Promise<{ ok: boolean }>;
  /** Calls the handler when the page is hidden or being unloaded. */
  onPageHide(handler: () => void): void;
  setInterval(fn: () => void, ms: number): unknown;
  clearInterval(handle: unknown): void;
}

export interface AnalyticsClientOptions {
  endpoint: string;
  deviceClass?: DeviceClass;
  saveData?: boolean;
  /** Admin preview: the server drops every event (M19-S01). */
  preview?: boolean;
  maxBatch?: number;
  maxQueue?: number;
  flushIntervalMs?: number;
}

export interface AnalyticsClient {
  track(event: AnalyticsEvent): void;
  /** Sends everything queued. Resolves when done and never rejects. */
  flush(): Promise<void>;
  /** Resolves when every request already started has finished. */
  idle(): Promise<void>;
  dispose(): void;
}

export function createAnalyticsClient(
  options: AnalyticsClientOptions,
  env: ClientEnv = browserEnv(),
): AnalyticsClient {
  const maxBatch = options.maxBatch ?? 20;
  const maxQueue = options.maxQueue ?? 200;
  let queue: AnalyticsEvent[] = [];
  const inflight = new Set<Promise<void>>();

  const body = (events: AnalyticsEvent[]): string =>
    JSON.stringify({
      v: EVENT_SCHEMA_VERSION,
      deviceClass: options.deviceClass,
      saveData: options.saveData,
      preview: options.preview,
      events,
    });

  const sendOne = (events: AnalyticsEvent[], unloading: boolean): Promise<void> => {
    const payload = body(events);
    try {
      if (unloading) {
        const data =
          typeof Blob === 'undefined' ? payload : new Blob([payload], { type: 'application/json' });
        if (env.sendBeacon(options.endpoint, data)) return Promise.resolve();
      }
      return env
        .fetch(options.endpoint, {
          method: 'POST',
          body: payload,
          keepalive: true,
          headers: { 'content-type': 'application/json' },
        })
        .then(() => undefined)
        .catch(() => undefined);
    } catch {
      return Promise.resolve();
    }
  };

  const drain = (unloading: boolean): Promise<void> => {
    const sends: Promise<void>[] = [];
    while (queue.length > 0) {
      const batch = queue.slice(0, maxBatch);
      queue = queue.slice(maxBatch);
      const send = sendOne(batch, unloading);
      inflight.add(send);
      void send.finally(() => inflight.delete(send));
      sends.push(send);
    }
    return Promise.all(sends).then(() => undefined);
  };

  const track = (event: AnalyticsEvent): void => {
    try {
      if (event.kind === 'progress') {
        // Progress is cumulative, so only the latest value per play matters.
        queue = queue.filter(
          (queued) => !(queued.kind === 'progress' && queued.playId === event.playId),
        );
      }
      queue.push(event);
      if (queue.length > maxQueue) queue = queue.slice(queue.length - maxQueue);
      if (queue.length >= maxBatch) void drain(false);
    } catch {
      // Analytics never affects playback.
    }
  };

  const timer = env.setInterval(() => void drain(false), options.flushIntervalMs ?? 10_000);
  env.onPageHide(() => void drain(true));

  return {
    track,
    flush: () => drain(false),
    idle: () => Promise.all([...inflight]).then(() => undefined),
    dispose: () => env.clearInterval(timer),
  };
}

/** Real browser wiring. Kept apart so the logic above is testable without a DOM. */
export function browserEnv(): ClientEnv {
  return {
    sendBeacon: (url, data) => navigator.sendBeacon(url, data),
    fetch: (url, init) => fetch(url, init),
    onPageHide(handler) {
      addEventListener('pagehide', handler);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') handler();
      });
    },
    setInterval: (fn, ms) => setInterval(fn, ms),
    clearInterval: (handle) => clearInterval(handle as ReturnType<typeof setInterval>),
  };
}
