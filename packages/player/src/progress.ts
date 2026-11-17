export interface ProgressUpdate {
  videoId: string;
  profileId: string;
  positionSeconds: number;
  durationSeconds: number;
  ended: boolean;
}

export interface ProgressSaveOptions {
  /** Use navigator.sendBeacon or keepalive fetch: the page is going away. */
  beacon?: boolean;
}

/**
 * Where progress goes. The server write is idempotent (see M09), so retries and
 * duplicate sends are safe. Throw ProgressSinkError with the HTTP status on failure,
 * or status 0 for a network failure.
 */
export interface ProgressSink {
  save(update: ProgressUpdate, options?: ProgressSaveOptions): Promise<void>;
}

export class ProgressSinkError extends Error {
  readonly status: number;
  constructor(status: number, message?: string) {
    super(message ?? `progress write failed with status ${status}`);
    this.name = 'ProgressSinkError';
    this.status = status;
  }
}

export type FlushReason = 'pause' | 'seek' | 'hidden' | 'ended' | 'manual';

export interface ProgressReporterOptions {
  sink: ProgressSink;
  videoId: string;
  profileId: string;
  /** Default 15 seconds (docs/ARCHITECTURE.md section 11). */
  intervalMs?: number;
  isOnline?: () => boolean;
  onUnauthorized?: () => void;
  onForbidden?: () => void;
}

export class ProgressReporter {
  private position = 0;
  private duration = Number.NaN;
  private timer: ReturnType<typeof setInterval> | null = null;
  private pending: ProgressUpdate | null = null;
  private lastSent: { position: number; ended: boolean } | null = null;
  private disposed = false;

  constructor(private readonly opts: ProgressReporterOptions) {}

  get hasPending(): boolean {
    return this.pending !== null;
  }

  update(position: number, duration: number): void {
    if (Number.isFinite(position) && position >= 0) this.position = position;
    this.duration = duration;
  }

  setPlaying(playing: boolean): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    if (playing && !this.disposed) {
      this.timer = setInterval(() => void this.send(false, undefined), this.opts.intervalMs ?? 15_000);
    }
  }

  flush(reason: FlushReason): Promise<void> {
    return this.send(reason === 'ended', undefined);
  }

  /** pagehide: fire and forget through the sink's beacon path. */
  beacon(): void {
    const update = this.build(false);
    if (!update) return;
    void this.opts.sink.save(update, { beacon: true }).catch(() => {
      this.pending = update;
    });
  }

  /** Send the newest queued write, for example after the browser fires `online`. */
  async retryPending(): Promise<void> {
    const p = this.pending;
    if (!p) return;
    this.pending = null;
    await this.deliver(p, undefined);
  }

  dispose(): void {
    this.disposed = true;
    this.setPlaying(false);
  }

  private build(ended: boolean): ProgressUpdate | null {
    if (!Number.isFinite(this.duration) || this.duration <= 0) return null;
    const position = ended ? this.duration : Math.min(this.position, this.duration);
    return {
      videoId: this.opts.videoId,
      profileId: this.opts.profileId,
      positionSeconds: Math.round(position * 10) / 10,
      durationSeconds: Math.round(this.duration * 10) / 10,
      ended,
    };
  }

  private async send(ended: boolean, options: ProgressSaveOptions | undefined): Promise<void> {
    const update = this.build(ended);
    if (!update) return;
    const last = this.lastSent;
    if (last && last.position === update.positionSeconds && last.ended === update.ended && !this.pending) return;
    await this.deliver(update, options);
  }

  private async deliver(update: ProgressUpdate, options: ProgressSaveOptions | undefined): Promise<void> {
    if (this.opts.isOnline && !this.opts.isOnline()) {
      this.pending = update;
      return;
    }
    try {
      await this.opts.sink.save(update, options);
      this.lastSent = { position: update.positionSeconds, ended: update.ended };
      this.pending = null;
    } catch (e) {
      const status = e instanceof ProgressSinkError ? e.status : 0;
      if (status === 401) {
        this.pending = null;
        this.opts.onUnauthorized?.();
      } else if (status === 403) {
        this.pending = null;
        this.opts.onForbidden?.();
      } else {
        // Keep only the newest write per video.
        this.pending = update;
      }
    }
  }
}
