export interface PlaybackSession {
  token: string;
  /** Epoch milliseconds. */
  expiresAt: number;
  masterUrl: string;
}

export type SessionErrorKind = 'auth' | 'gone' | 'network' | 'rate-limited';

/**
 * Thrown by a SessionProvider.
 * auth: 401, the viewer must sign in again. gone: 404, 410 or an unpublished video.
 * network: the request could not be made. rate-limited: 429.
 */
export class SessionError extends Error {
  readonly kind: SessionErrorKind;
  constructor(kind: SessionErrorKind, message?: string) {
    super(message ?? `playback session ${kind}`);
    this.name = 'SessionError';
    this.kind = kind;
  }
}

/** Mints playback tokens: POST /api/play/{videoId}/session. */
export interface SessionProvider {
  createSession(videoId: string, signal?: AbortSignal): Promise<PlaybackSession>;
}

export interface TokenManagerOptions {
  videoId: string;
  provider: SessionProvider;
  initial?: PlaybackSession;
  /** Refresh this long before expiry. Default 2 minutes. */
  refreshLeadMs?: number;
  /** Delay before retrying a scheduled refresh that failed on the network. Default 10 seconds. */
  retryDelayMs?: number;
  maxScheduledRetries?: number;
  onFailure?: (error: SessionError) => void;
}

export class TokenManager {
  private current: PlaybackSession | null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private inflight: Promise<PlaybackSession> | null = null;
  private listeners = new Set<(s: PlaybackSession) => void>();
  private disposed = false;
  private readonly lead: number;
  private readonly retryDelay: number;
  private readonly maxRetries: number;

  constructor(private readonly opts: TokenManagerOptions) {
    this.current = opts.initial ?? null;
    this.lead = opts.refreshLeadMs ?? 120_000;
    this.retryDelay = opts.retryDelayMs ?? 10_000;
    this.maxRetries = opts.maxScheduledRetries ?? 3;
    if (this.current) this.schedule(this.current);
  }

  get token(): string | null {
    return this.current?.token ?? null;
  }

  get masterUrl(): string | null {
    return this.current?.masterUrl ?? null;
  }

  get expiresAt(): number | null {
    return this.current?.expiresAt ?? null;
  }

  subscribe(listener: (s: PlaybackSession) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Mint a fresh token. Concurrent callers share one request. */
  refresh(): Promise<PlaybackSession> {
    if (this.inflight) return this.inflight;
    const p = this.opts.provider
      .createSession(this.opts.videoId)
      .then((s) => {
        this.current = s;
        if (!this.disposed) {
          this.schedule(s);
          for (const l of this.listeners) l(s);
        }
        return s;
      })
      .catch((e: unknown) => {
        throw e instanceof SessionError ? e : new SessionError('network');
      })
      .finally(() => {
        this.inflight = null;
      });
    this.inflight = p;
    return p;
  }

  dispose(): void {
    this.disposed = true;
    this.listeners.clear();
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  private schedule(s: PlaybackSession, attempt = 0): void {
    if (this.timer) clearTimeout(this.timer);
    const delay =
      attempt === 0 ? Math.max(0, s.expiresAt - Date.now() - this.lead) : this.retryDelay;
    this.timer = setTimeout(() => {
      this.refresh().catch((e: SessionError) => {
        if (this.disposed) return;
        if (e.kind === 'network' && attempt < this.maxRetries) {
          this.schedule(s, attempt + 1);
          return;
        }
        this.opts.onFailure?.(e);
      });
    }, delay);
  }
}

/** The app adds Authorization only for its own origin. Media domain requests carry no custom headers. */
export function shouldAttachAuth(url: string, appOrigin: string): boolean {
  try {
    return new URL(url, appOrigin).origin === new URL(appOrigin).origin;
  } catch {
    return false;
  }
}

const KEY_SCHEME = 'ad-key://';

/** Playlist templates carry `ad-key://{videoId}`. Resolve to the key route on the app origin. */
export function resolveKeyUrl(uri: string, appOrigin: string): string {
  if (!uri.startsWith(KEY_SCHEME)) return uri;
  const id = uri.slice(KEY_SCHEME.length);
  return `${appOrigin}/api/hls/keys/${encodeURIComponent(decodeURIComponent(id))}`;
}

const NATIVE_TOKEN_PATHS = ['/api/play/', '/api/hls/keys/'];

/** Native HLS cannot set headers, so the token travels as ?pt= on playlist and key routes only. */
export function withNativeToken(url: string, token: string, appOrigin: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url, appOrigin);
  } catch {
    return url;
  }
  if (parsed.origin !== new URL(appOrigin).origin) return url;
  if (!NATIVE_TOKEN_PATHS.some((p) => parsed.pathname.startsWith(p))) return url;
  parsed.searchParams.set('pt', token);
  return parsed.toString();
}

interface LoaderContext {
  url: string;
}

interface LoaderLike {
  load(context: LoaderContext, ...rest: never[]): void;
}

type LoaderCtor = new () => LoaderLike;

/**
 * Wraps an hls.js loader class so `ad-key://` key URIs resolve to the key route.
 * The base class is injected so the wrapper is testable without hls.js.
 */
export function createKeyAwareLoader(Base: LoaderCtor, appOrigin: string): LoaderCtor {
  return class KeyAwareLoader extends Base {
    override load(context: LoaderContext, ...rest: never[]): void {
      context.url = resolveKeyUrl(context.url, appOrigin);
      super.load(context, ...rest);
    }
  };
}
