import type {
  EngineError,
  EngineEvent,
  NetworkMonitor,
  PageEvents,
  PlayerEngine,
  PlayerMedia,
} from './engine';
import type { ShortcutAction } from './keyboard';
import { ProgressReporter, type ProgressSink } from './progress';
import {
  buildQualityMenu,
  detectLowData,
  effectiveCap,
  type NetworkHints,
  type QualitySelection,
} from './quality';
import { computeStartPosition, type ResumeInput } from './resume';
import { formatClock } from './format';
import { SessionError, type PlaybackSession } from './token';
import {
  DEFAULT_PREFERENCES,
  PLAYBACK_RATES,
  type CaptionTrack,
  type MetricsSink,
  type PlayerErrorKind,
  type PlayerPreferences,
  type PlayerState,
  type PlayerToast,
  type UpNextItem,
} from './types';

/** What the controller needs from the token layer. TokenManager satisfies it. */
export interface TokenSource {
  readonly token: string | null;
  readonly masterUrl: string | null;
  refresh(): Promise<PlaybackSession>;
  subscribe?(listener: (session: { token: string }) => void): () => void;
}

export interface PlayerControllerOptions {
  media: PlayerMedia;
  engine: PlayerEngine;
  tokens: TokenSource;
  videoId: string;
  profileId: string;
  sink: ProgressSink;
  preferences?: Partial<PlayerPreferences>;
  captions?: CaptionTrack[];
  resume?: Omit<ResumeInput, 'rewind' | 'minSaved'>;
  upNext?: UpNextItem | null;
  network?: NetworkMonitor;
  page?: PageEvents;
  hints?: NetworkHints;
  dataSaverMaxHeight?: number;
  countdownSeconds?: number;
  progressIntervalMs?: number;
  autoplay?: boolean;
  metrics?: MetricsSink;
  deviceClass?: string;
  onPreferencesChange?: (preferences: PlayerPreferences) => void;
  onNext?: (item: UpNextItem) => void;
  onUnauthorized?: () => void;
  onForbidden?: () => void;
}

const SPINNER_AFTER_MS = 500;
const SLOW_AFTER_MS = 8_000;
const STALL_RECOVERY_MS = 20_000;
const AUTH_RETRY_WINDOW_MS = 15_000;
const UP_NEXT_TILE_SECONDS = 15;
const END_GUARD_SECONDS = 0.5;
const SEEK_TIMEOUT_MS = 6_000;
const SEGMENT_SECONDS = 6;

const ERROR_ANNOUNCE: Record<PlayerErrorKind, string> = {
  'connection-lost': 'Connection lost',
  offline: 'You are offline',
  'session-expired': 'Sign in again to keep watching',
  removed: 'This video is no longer available',
  'cannot-play': 'This video cannot play on this device',
  'unsupported-browser': 'This browser cannot play this video',
};

type Listener = () => void;

/**
 * Framework free state machine for one playback session. It owns no DOM: the media element,
 * the streaming engine, the clock sources and the sinks are injected, so every rule in
 * M08 and M11 can be tested with fakes.
 */
export class PlayerController {
  private state: PlayerState;
  private listeners = new Set<Listener>();
  private cleanups: Array<() => void> = [];
  private readonly reporter: ProgressReporter;
  private readonly prefs: PlayerPreferences;
  private readonly tracks: CaptionTrack[];
  private readonly dataSaverMaxHeight: number;
  private readonly network: NetworkMonitor | undefined;

  private heights: number[] = [];
  private selected: QualitySelection = 'auto';
  private currentHeight: number | null = null;
  private bitrates: number[] = [];

  private loaded = false;
  private firstFrame = false;
  private disposed = false;
  private wasPlaying = false;
  private startedAt = 0;
  private startupMs: number | null = null;
  private errors: string[] = [];

  private spinnerTimer: ReturnType<typeof setTimeout> | null = null;
  private firstFrameTimer: ReturnType<typeof setTimeout> | null = null;
  private slowTimer: ReturnType<typeof setTimeout> | null = null;
  private recoverTimer: ReturnType<typeof setTimeout> | null = null;
  private stallStartedAt: number | null = null;
  private stallAt = 0;
  private rebufferCount = 0;
  private rebufferMs = 0;

  private toastTimer: ReturnType<typeof setTimeout> | null = null;
  private toastSeq = 0;
  private countdownTimer: ReturnType<typeof setInterval> | null = null;
  private tileDismissed = false;
  private metricsTimer: ReturnType<typeof setInterval> | null = null;

  private refreshing = false;
  private lastRefreshAt = -Infinity;
  private mediaErrors = 0;
  private pendingStop: PlayerErrorKind | null = null;
  private seekTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly o: PlayerControllerOptions) {
    this.prefs = { ...DEFAULT_PREFERENCES, ...o.preferences };
    this.tracks = (o.captions ?? []).filter((t) => t.status === 'approved');
    this.dataSaverMaxHeight = o.dataSaverMaxHeight ?? 360;
    this.network = o.network;
    this.reporter = new ProgressReporter({
      sink: o.sink,
      videoId: o.videoId,
      profileId: o.profileId,
      ...(o.progressIntervalMs !== undefined ? { intervalMs: o.progressIntervalMs } : {}),
      isOnline: () => this.network?.isOnline() ?? true,
      onUnauthorized: () => {
        this.setError('session-expired');
        o.onUnauthorized?.();
      },
      onForbidden: () => o.onForbidden?.(),
    });
    const active = this.prefs.captionsOn ? (this.pickTrack()?.id ?? null) : null;
    this.state = {
      phase: 'loading',
      playing: false,
      buffering: false,
      slowNotice: false,
      error: null,
      currentTime: 0,
      duration: Number.NaN,
      bufferedEnd: 0,
      volume: this.prefs.volume,
      muted: this.prefs.muted,
      rate: this.prefs.rate,
      captions: { available: this.tracks.length > 0, tracks: this.tracks, active },
      quality: this.qualityState(),
      toast: null,
      upNext: { tile: false, countdown: null, cancelled: false },
      hasAudio: true,
      backOnline: false,
      announce: '',
    };
  }

  // ---- store api ----

  getState = (): PlayerState => this.state;

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private set(patch: Partial<PlayerState>): void {
    this.state = { ...this.state, ...patch };
    for (const l of [...this.listeners]) l();
  }

  // ---- lifecycle ----

  start(): void {
    const { media, engine } = this.o;
    this.startedAt = Date.now();
    media.volume = this.prefs.volume;
    media.muted = this.prefs.muted;
    media.playbackRate = this.prefs.rate;

    for (const ev of [
      'play',
      'playing',
      'pause',
      'ended',
      'waiting',
      'seeked',
      'timeupdate',
      'durationchange',
      'loadedmetadata',
      'canplay',
      'loadeddata',
      'volumechange',
      'progress',
      'error',
    ]) {
      const handler = (e: Event) => this.onMedia(e.type);
      media.addEventListener(ev, handler);
      this.cleanups.push(() => media.removeEventListener(ev, handler));
    }
    this.cleanups.push(engine.on((e) => this.onEngine(e)));
    if (this.network)
      this.cleanups.push(this.network.subscribe((online) => this.onNetwork(online)));
    if (this.o.page) {
      this.cleanups.push(
        this.o.page.onVisibility((hidden) => {
          if (hidden) {
            this.syncProgress();
            void this.reporter.flush('hidden');
          }
        }),
      );
      this.cleanups.push(
        this.o.page.onPageHide(() => {
          this.syncProgress();
          this.reporter.beacon();
        }),
      );
    }
    this.cleanups.push(
      this.o.tokens.subscribe?.((s) => this.o.engine.setToken(s.token)) ?? (() => undefined),
    );
    if (this.o.metrics) {
      this.metricsTimer = setInterval(() => {
        if (this.state.playing) this.reportMetrics(false);
      }, 60_000);
    }

    const resume = computeStartPosition(this.o.resume ?? {});
    if (resume.resumedFrom !== null) {
      this.toast(
        {
          kind: 'resume',
          message: `Resumed from ${formatClock(resume.resumedFrom)}`,
          action: 'start-over',
        },
        8_000,
      );
    }
    this.initialStart = resume.start;

    if (this.network && !this.network.isOnline()) {
      this.setError('offline');
      return;
    }
    this.load();
  }

  private initialStart = 0;

  private load(): void {
    this.loaded = true;
    const { engine, tokens } = this.o;
    const lowData = detectLowData(this.o.hints) || this.prefs.dataSaver;
    engine.setToken(tokens.token);
    engine.load({
      src: tokens.masterUrl ?? '',
      startPosition: this.initialStart,
      lowData,
      cap: this.cap(),
    });
    this.firstFrameTimer = setTimeout(() => {
      if (!this.firstFrame && !this.state.error) this.set({ buffering: true, announce: 'Loading' });
    }, SPINNER_AFTER_MS);
    if (this.o.autoplay ?? true) this.play();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.syncProgress();
    this.reporter.beacon();
    this.reporter.dispose();
    this.reportMetrics(true);
    this.clearStall();
    this.clearSeekWatch();
    this.clearCountdown();
    for (const t of [this.firstFrameTimer, this.toastTimer]) if (t) clearTimeout(t);
    if (this.metricsTimer) clearInterval(this.metricsTimer);
    for (const c of this.cleanups.splice(0)) c();
    this.o.engine.destroy();
    this.listeners.clear();
  }

  // ---- commands ----

  play(): void {
    this.set({ backOnline: false });
    void this.o.media.play().catch(() => undefined);
  }

  pause(): void {
    this.o.media.pause();
  }

  toggle(): void {
    if (this.o.media.paused || this.o.media.ended) {
      if (this.o.media.ended) this.replay();
      else this.play();
    } else {
      this.pause();
    }
  }

  seekTo(seconds: number): void {
    const { media } = this.o;
    const d = media.duration;
    const max = Number.isFinite(d) ? d : Infinity;
    const t = Math.min(Math.max(0, seconds), max);
    media.currentTime = t;
    this.watchSeek(t, 0);
    this.reporter.update(t, d);
    this.set({ currentTime: t });
  }

  /**
   * M08-S03 Error: a seek that never completes is retried once, then falls back to the nearest segment start.
   * The position stays where the viewer asked for it while the engine works.
   */
  private watchSeek(target: number, attempt: 0 | 1): void {
    if (this.seekTimer) clearTimeout(this.seekTimer);
    this.seekTimer = setTimeout(() => {
      this.seekTimer = null;
      if (this.disposed) return;
      const { media, engine } = this.o;
      if (attempt === 0) {
        media.currentTime = target;
        engine.recover();
        this.watchSeek(target, 1);
        return;
      }
      const start =
        engine.segmentStart?.(target) ?? Math.floor(target / SEGMENT_SECONDS) * SEGMENT_SECONDS;
      media.currentTime = start;
      this.reporter.update(start, media.duration);
      this.set({ currentTime: start });
      this.notify('Could not jump there, so we jumped to the nearest point');
    }, SEEK_TIMEOUT_MS);
  }

  private clearSeekWatch(): void {
    if (this.seekTimer) clearTimeout(this.seekTimer);
    this.seekTimer = null;
  }

  seekBy(delta: number): void {
    this.seekTo(this.o.media.currentTime + delta);
  }

  setVolume(value: number): void {
    const v = Math.round(Math.min(1, Math.max(0, value)) * 100) / 100;
    this.o.media.volume = v;
    if (v > 0 && this.o.media.muted) this.o.media.muted = false;
    this.prefs.volume = v;
    this.prefs.muted = this.o.media.muted;
    this.set({ volume: v, muted: this.o.media.muted });
    this.persist();
  }

  adjustVolume(delta: number): void {
    this.setVolume(this.o.media.volume + delta);
  }

  toggleMute(): void {
    const muted = !this.o.media.muted;
    this.o.media.muted = muted;
    this.prefs.muted = muted;
    this.set({ muted });
    this.persist();
  }

  setRate(rate: number): void {
    const nearest = PLAYBACK_RATES.reduce((best, r) =>
      Math.abs(r - rate) < Math.abs(best - rate) ? r : best,
    );
    this.o.media.playbackRate = nearest;
    this.prefs.rate = nearest;
    this.set({ rate: nearest });
    this.persist();
  }

  stepRate(direction: -1 | 1): void {
    const i = PLAYBACK_RATES.findIndex((r) => r === this.state.rate);
    const from = i === -1 ? PLAYBACK_RATES.indexOf(1) : i;
    const next = PLAYBACK_RATES[Math.min(PLAYBACK_RATES.length - 1, Math.max(0, from + direction))];
    if (next !== undefined) this.setRate(next);
  }

  selectQuality(selection: QualitySelection): void {
    const cap = this.cap();
    if (typeof selection === 'number' && cap !== null && selection > cap) return;
    this.selected = selection;
    this.o.engine.setQuality(selection, cap);
    this.set({ quality: this.qualityState() });
  }

  setDataSaver(on: boolean): void {
    this.prefs.dataSaver = on;
    const cap = this.cap();
    if (typeof this.selected === 'number' && cap !== null && this.selected > cap)
      this.selected = 'auto';
    this.o.engine.setQuality(this.selected, cap);
    this.set({ quality: this.qualityState() });
    this.persist();
  }

  toggleCaptions(): void {
    if (this.tracks.length === 0) return;
    this.selectCaption(this.state.captions.active ? null : (this.pickTrack()?.id ?? null));
  }

  selectCaption(id: string | null): void {
    const track = id ? this.tracks.find((t) => t.id === id) : undefined;
    if (id && !track) return;
    this.prefs.captionsOn = track !== undefined;
    if (track) this.prefs.captionLanguage = track.language;
    this.set({
      captions: { ...this.state.captions, active: track?.id ?? null },
      announce: track ? `Captions on, ${track.label}` : 'Captions off',
    });
    this.persist();
  }

  captionFailed(id: string): void {
    const english = this.tracks.find((t) => t.language === 'en');
    const failed = this.tracks.find((t) => t.id === id);
    if (failed && failed.language !== 'en' && english) {
      this.set({ captions: { ...this.state.captions, active: english.id } });
    }
    this.toast({ kind: 'error', message: 'Captions could not load' }, 6_000);
  }

  startOver(): void {
    this.dismissToast();
    this.seekTo(0);
    this.syncProgress();
    void this.reporter.flush('manual');
  }

  retry(): void {
    const kind = this.state.error;
    if (!kind || kind === 'unsupported-browser') return;
    const { engine, media } = this.o;
    this.set({
      error: null,
      backOnline: false,
      phase: this.firstFrame ? 'ready' : 'loading',
      announce: '',
    });
    if (!this.loaded) {
      this.load();
      return;
    }
    if (kind === 'cannot-play' || kind === 'session-expired') engine.reload(media.currentTime);
    else engine.recover();
    this.armStallRecovery();
    if (this.wasPlaying) this.play();
  }

  /** Show a short message in the toast slot, for example when full screen is refused. */
  notify(message: string, kind: PlayerToast['kind'] = 'info'): void {
    this.toast({ kind, message }, 6_000);
  }

  dismissToast(): void {
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.set({ toast: null });
  }

  cancelCountdown(): void {
    if (this.state.upNext.countdown === null) return;
    this.clearCountdown();
    this.set({
      upNext: { ...this.state.upNext, countdown: null, cancelled: true },
      announce: 'Autoplay cancelled',
    });
  }

  dismissUpNextTile(): void {
    this.tileDismissed = true;
    this.set({ upNext: { ...this.state.upNext, tile: false } });
  }

  playNext(): void {
    const next = this.o.upNext;
    if (!next) return;
    this.clearCountdown();
    this.o.onNext?.(next);
  }

  replay(): void {
    this.clearCountdown();
    this.tileDismissed = false;
    this.o.media.currentTime = 0;
    this.set({
      phase: 'ready',
      currentTime: 0,
      upNext: { tile: false, countdown: null, cancelled: false },
    });
    this.play();
  }

  dispatch(action: ShortcutAction): void {
    switch (action.type) {
      case 'toggle-play':
        this.toggle();
        break;
      case 'seek-by':
        this.seekBy(action.seconds);
        break;
      case 'seek-start':
        this.seekTo(0);
        break;
      case 'seek-end':
        if (Number.isFinite(this.o.media.duration)) this.seekTo(this.o.media.duration - 1);
        break;
      case 'seek-fraction':
        if (Number.isFinite(this.o.media.duration))
          this.seekTo(this.o.media.duration * action.fraction);
        break;
      case 'volume-by':
        this.adjustVolume(action.delta);
        break;
      case 'toggle-mute':
        this.toggleMute();
        break;
      case 'toggle-captions':
        this.toggleCaptions();
        break;
      case 'speed-step':
        this.stepRate(action.direction);
        break;
      case 'next':
        this.playNext();
        break;
      case 'toggle-fullscreen':
      case 'help':
        // Handled by the view: they need the DOM.
        break;
    }
  }

  /** Wire TokenManager.onFailure here (M08-S21 AC3, M08-S23 AC2). */
  handleSessionFailure(error: SessionError): void {
    if (error.kind === 'gone') this.pendingStop = 'removed';
    else if (error.kind === 'auth') this.pendingStop = 'session-expired';
    this.checkPendingStop();
  }

  // ---- media events ----

  private onMedia(type: string): void {
    const { media } = this.o;
    switch (type) {
      case 'play':
      case 'playing': {
        if (type === 'playing') this.onFirstFrame();
        this.clearStall();
        this.reporter.setPlaying(!media.paused);
        this.set({
          playing: !media.paused,
          ...(this.state.error ? {} : { buffering: false, slowNotice: false }),
        });
        this.sync();
        break;
      }
      case 'canplay':
      case 'loadeddata':
        this.onFirstFrame();
        break;
      case 'pause':
        this.reporter.setPlaying(false);
        this.set({ playing: false });
        if (!media.ended) {
          this.syncProgress();
          void this.reporter.flush('pause');
        }
        break;
      case 'seeked':
        this.clearSeekWatch();
        this.syncProgress();
        void this.reporter.flush('seek');
        this.sync();
        break;
      case 'waiting':
        this.onWaiting();
        break;
      case 'timeupdate':
      case 'progress':
        this.onTime();
        break;
      case 'durationchange':
      case 'loadedmetadata':
      case 'volumechange':
        this.sync();
        break;
      case 'ended':
        this.onEnded();
        break;
      case 'error':
        this.onMediaError();
        break;
    }
  }

  private sync(): void {
    const { media } = this.o;
    this.reporter.update(media.currentTime, media.duration);
    this.set({
      currentTime: media.currentTime,
      duration: media.duration,
      bufferedEnd: this.bufferedEnd(),
      volume: media.volume,
      muted: media.muted,
    });
  }

  private syncProgress(): void {
    this.reporter.update(this.o.media.currentTime, this.o.media.duration);
  }

  private bufferedEnd(): number {
    const { media } = this.o;
    const t = media.currentTime;
    let last = 0;
    for (let i = 0; i < media.buffered.length; i++) {
      const s = media.buffered.start(i);
      const e = media.buffered.end(i);
      last = e;
      if (t >= s - 0.1 && t <= e + 0.1) return e;
    }
    return last;
  }

  private onFirstFrame(): void {
    if (this.firstFrame) return;
    this.firstFrame = true;
    this.startupMs = Date.now() - this.startedAt;
    if (this.firstFrameTimer) clearTimeout(this.firstFrameTimer);
    if (!this.state.error) this.set({ phase: 'ready', buffering: false });
  }

  private onTime(): void {
    const { media } = this.o;
    this.sync();
    if (this.stallStartedAt !== null && media.currentTime > this.stallAt + 0.1) this.clearStall();
    const remaining = media.duration - media.currentTime;
    const next = this.o.upNext;
    const tile =
      !!next &&
      !this.tileDismissed &&
      Number.isFinite(remaining) &&
      remaining <= UP_NEXT_TILE_SECONDS &&
      remaining > 0;
    if (tile !== this.state.upNext.tile) this.set({ upNext: { ...this.state.upNext, tile } });
    this.checkPendingStop();
  }

  private checkPendingStop(): void {
    if (!this.pendingStop || this.state.error) return;
    if (this.bufferedEnd() - this.o.media.currentTime < END_GUARD_SECONDS) {
      const kind = this.pendingStop;
      this.pendingStop = null;
      this.setError(kind);
    }
  }

  private onWaiting(): void {
    if (!this.firstFrame || this.state.error) return;
    if (this.network && !this.network.isOnline()) {
      this.setError('offline');
      return;
    }
    this.checkPendingStop();
    if (this.stallStartedAt !== null) return;
    this.stallStartedAt = Date.now();
    this.stallAt = this.o.media.currentTime;
    this.rebufferCount += 1;
    this.spinnerTimer = setTimeout(
      () => this.set({ buffering: true, announce: 'Buffering' }),
      SPINNER_AFTER_MS,
    );
    this.slowTimer = setTimeout(() => {
      if (this.selected !== 'auto') return;
      this.o.engine.dropQuality();
      this.set({ slowNotice: true, announce: 'Slow connection. Switching to lower quality' });
    }, SLOW_AFTER_MS);
    this.armStallRecovery();
  }

  private armStallRecovery(): void {
    if (this.recoverTimer) clearTimeout(this.recoverTimer);
    this.recoverTimer = setTimeout(() => {
      if (this.stallStartedAt === null) return;
      this.onNetworkFailure();
    }, STALL_RECOVERY_MS);
  }

  private clearStall(): void {
    if (this.stallStartedAt !== null) {
      this.rebufferMs += Date.now() - this.stallStartedAt;
      this.stallStartedAt = null;
    }
    for (const t of [this.spinnerTimer, this.slowTimer, this.recoverTimer]) if (t) clearTimeout(t);
    this.spinnerTimer = this.slowTimer = this.recoverTimer = null;
  }

  private onEnded(): void {
    const { media } = this.o;
    this.reporter.setPlaying(false);
    this.reporter.update(media.duration, media.duration);
    void this.reporter.flush('ended');
    this.clearStall();
    this.set({ phase: 'ended', playing: false, buffering: false, slowNotice: false });
    const next = this.o.upNext;
    if (next && this.prefs.autoplayNext) this.startCountdown();
  }

  private startCountdown(): void {
    const seconds = this.o.countdownSeconds ?? 5;
    this.clearCountdown();
    this.set({
      upNext: { tile: false, countdown: seconds, cancelled: false },
      announce: `Next video starts in ${seconds} seconds`,
    });
    this.countdownTimer = setInterval(() => {
      const left = (this.state.upNext.countdown ?? 0) - 1;
      if (left <= 0) {
        this.clearCountdown();
        this.set({ upNext: { ...this.state.upNext, countdown: null } });
        this.playNext();
        return;
      }
      this.set({ upNext: { ...this.state.upNext, countdown: left } });
    }, 1_000);
  }

  private clearCountdown(): void {
    if (this.countdownTimer) clearInterval(this.countdownTimer);
    this.countdownTimer = null;
  }

  private onMediaError(): void {
    this.errors.push('media');
    this.mediaErrors += 1;
    if (this.mediaErrors === 1) {
      this.o.engine.dropQuality();
      this.o.engine.recoverMedia();
      return;
    }
    this.setError('cannot-play');
  }

  // ---- engine and network ----

  private onEngine(e: EngineEvent): void {
    if (e.type === 'levels') {
      this.heights = e.heights;
      this.set({
        quality: this.qualityState(),
        ...(e.audio === undefined ? {} : { hasAudio: e.audio }),
      });
    } else if (e.type === 'level') {
      this.currentHeight = e.height;
      if (e.bitrate) this.bitrates.push(e.bitrate);
      this.set({ quality: this.qualityState() });
    } else {
      this.onEngineError(e.error);
    }
  }

  private onEngineError(err: EngineError): void {
    if (!err.fatal) return;
    this.errors.push(`${err.kind}${err.status ? `:${err.status}` : ''}`);
    switch (err.kind) {
      case 'auth':
      case 'forbidden':
        void this.refreshAndReload(err.kind);
        break;
      case 'gone':
        this.setError('removed');
        break;
      case 'network':
        this.onNetworkFailure();
        break;
      case 'media':
        this.onMediaError();
        break;
      case 'unsupported':
        this.setError('unsupported-browser');
        break;
    }
  }

  private onNetworkFailure(): void {
    if (this.network && !this.network.isOnline()) {
      this.setError('offline');
      return;
    }
    if (this.o.engine.dropQuality()) {
      this.o.engine.recover();
      this.armStallRecovery();
      return;
    }
    this.setError('connection-lost');
  }

  private async refreshAndReload(kind: 'auth' | 'forbidden'): Promise<void> {
    if (this.refreshing) return;
    const final: PlayerErrorKind = kind === 'auth' ? 'session-expired' : 'removed';
    if (Date.now() - this.lastRefreshAt < AUTH_RETRY_WINDOW_MS) {
      this.setError(final);
      return;
    }
    this.refreshing = true;
    try {
      // Read the intent first: tearing down the engine resets `paused` on a real media element.
      const resumePlayback = this.wantsPlayback();
      const session = await this.o.tokens.refresh();
      this.lastRefreshAt = Date.now();
      this.o.engine.setToken(session.token);
      this.o.engine.reload(this.o.media.currentTime);
      if (resumePlayback) this.play();
    } catch (e) {
      const k = e instanceof SessionError ? e.kind : 'network';
      this.setError(
        k === 'auth' ? 'session-expired' : k === 'gone' ? 'removed' : 'connection-lost',
      );
    } finally {
      this.refreshing = false;
    }
  }

  /** True when the viewer is playing, or autoplay is still waiting for the first frame. */
  private wantsPlayback(): boolean {
    if (!this.o.media.paused) return true;
    return !this.firstFrame && (this.o.autoplay ?? true);
  }

  private onNetwork(online: boolean): void {
    if (!online) {
      if (this.state.buffering || this.stallStartedAt !== null) this.setError('offline');
      return;
    }
    void this.reporter.retryPending();
    if (!this.loaded) {
      this.set({ error: null, phase: 'loading', announce: '' });
      this.load();
      return;
    }
    const kind = this.state.error;
    if (kind === 'offline' || kind === 'connection-lost') {
      if (this.wasPlaying) {
        this.retry();
      } else {
        this.set({ error: null, phase: 'ready', backOnline: true, announce: 'Back online' });
        this.o.engine.recover();
      }
    }
  }

  // ---- errors, toasts, preferences ----

  private setError(kind: PlayerErrorKind): void {
    if (this.state.error === kind) return;
    if (!this.state.error) this.wasPlaying = !this.o.media.paused;
    this.sync();
    void this.reporter.flush('manual');
    this.clearStall();
    this.clearCountdown();
    if (!this.o.media.paused) this.o.media.pause();
    this.reporter.setPlaying(false);
    this.set({
      phase: 'error',
      error: kind,
      playing: false,
      buffering: false,
      slowNotice: false,
      announce: ERROR_ANNOUNCE[kind],
    });
  }

  private toast(t: Omit<PlayerToast, 'id'>, ms: number): void {
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastSeq += 1;
    this.set({ toast: { ...t, id: this.toastSeq } });
    this.toastTimer = setTimeout(() => this.set({ toast: null }), ms);
  }

  private persist(): void {
    this.o.onPreferencesChange?.({ ...this.prefs });
  }

  private cap(): number | null {
    return effectiveCap({
      dataSaver: this.prefs.dataSaver,
      dataSaverMaxHeight: this.dataSaverMaxHeight,
    });
  }

  private pickTrack(): CaptionTrack | undefined {
    return this.tracks.find((t) => t.language === this.prefs.captionLanguage) ?? this.tracks[0];
  }

  private qualityState(): PlayerState['quality'] {
    return {
      menu: buildQualityMenu({
        heights: this.heights,
        selected: this.selected,
        currentHeight: this.currentHeight,
        dataSaver: this.prefs.dataSaver,
        dataSaverMaxHeight: this.dataSaverMaxHeight,
      }),
      selected: this.selected,
      currentHeight: this.currentHeight,
      dataSaver: this.prefs.dataSaver,
    };
  }

  private reportMetrics(final: boolean): void {
    if (!this.o.metrics) return;
    const stalled = this.stallStartedAt !== null ? Date.now() - this.stallStartedAt : 0;
    const avg = this.bitrates.length
      ? this.bitrates.reduce((a, b) => a + b, 0) / this.bitrates.length
      : null;
    this.o.metrics.report({
      startupMs: this.startupMs,
      rebufferCount: this.rebufferCount,
      rebufferMs: this.rebufferMs + stalled,
      errors: [...this.errors],
      averageBitrate: avg,
      deviceClass: this.o.deviceClass ?? 'unknown',
      final,
    });
  }
}
