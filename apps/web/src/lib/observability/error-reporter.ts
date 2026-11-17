export interface ErrorContext {
  route?: string;
  requestId?: string;
}

export interface ErrorReporter {
  readonly enabled: boolean;
  /** Fire and forget. Never throws. */
  capture(error: unknown, context: ErrorContext): void;
  /** Waits for sends in flight. For tests and shutdown. */
  flush(): Promise<void>;
}

type FetchLike = (
  url: string,
  init: { method: 'POST'; body: string; headers: Record<string, string> },
) => Promise<{ ok: boolean }>;

export interface ReporterOptions {
  /** Empty or missing means off. Tracking is opt in (SENTRY_DSN). */
  dsn: string | undefined;
  release: string;
  fetch?: FetchLike;
  now?: () => number;
}

export function parseDsn(dsn: string): { key: string; endpoint: string } | null {
  try {
    const url = new URL(dsn);
    const project = url.pathname.replace(/^\/+/, '');
    if (!url.username || !/^\d+$/.test(project)) return null;
    return { key: url.username, endpoint: `${url.protocol}//${url.host}/api/${project}/envelope/` };
  } catch {
    return null;
  }
}

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const GROUP_WINDOW_MS = 60_000;
const scrub = (text: string) => text.replace(EMAIL, '[email]').slice(0, 500);

const OFF: ErrorReporter = { enabled: false, capture() {}, flush: async () => {} };

/**
 * Minimal Sentry compatible reporter over fetch, so the app has no SDK dependency and nothing runs unless a
 * DSN is set. Events carry release, route and request id only: no user, no cookies, no query strings, and
 * emails in messages are masked. A tracking outage is ignored (M24-S03).
 */
export function createErrorReporter(options: ReporterOptions): ErrorReporter {
  const target = options.dsn ? parseDsn(options.dsn) : null;
  if (!target || !options.dsn) return OFF;
  const send = options.fetch ?? ((url, init) => fetch(url, init));
  const now = options.now ?? Date.now;
  const lastSent = new Map<string, number>();
  const pending = new Set<Promise<unknown>>();

  return {
    enabled: true,
    capture(error, context) {
      try {
        const err = error instanceof Error ? error : new Error(String(error));
        const fingerprint = `${err.name}|${scrub(err.message)}|${context.route ?? ''}`;
        const t = now();
        const previous = lastSent.get(fingerprint);
        if (previous !== undefined && t - previous < GROUP_WINDOW_MS) return;
        lastSent.set(fingerprint, t);
        if (lastSent.size > 200) lastSent.delete(lastSent.keys().next().value as string);

        const eventId = crypto.randomUUID().replaceAll('-', '');
        const event = {
          event_id: eventId,
          timestamp: t / 1000,
          platform: 'node',
          level: 'error',
          release: options.release,
          fingerprint: [err.name, context.route ?? 'unknown'],
          tags: { route: context.route ?? 'unknown', request_id: context.requestId ?? 'none' },
          exception: { values: [{ type: err.name, value: scrub(err.message) }] },
        };
        const body = [
          JSON.stringify({ event_id: eventId, sent_at: new Date(t).toISOString() }),
          JSON.stringify({ type: 'event' }),
          JSON.stringify(event),
        ].join('\n');
        const request = send(target.endpoint, {
          method: 'POST',
          body,
          headers: {
            'Content-Type': 'application/x-sentry-envelope',
            'X-Sentry-Auth': `Sentry sentry_version=7, sentry_key=${target.key}, sentry_client=ad-web/1`,
          },
        }).catch(() => undefined);
        pending.add(request);
        void request.finally(() => pending.delete(request));
      } catch {
        // Never let error reporting cause an error.
      }
    },
    flush: () => Promise.all([...pending]).then(() => undefined),
  };
}
