import type { AnalyticsEvent } from '../events';

export interface PlayTrackerOptions {
  videoId: string;
  durationMs: number;
  track(event: AnalyticsEvent): void;
  randomUUID?: () => string;
  /** Watch time before a view counts. M19-S01 AC1. */
  viewAfterMs?: number;
  /** Progress heartbeat. M19-S01 AC2. */
  heartbeatMs?: number;
  /** Fraction of the duration that counts as finished. */
  finishFraction?: number;
  /** Largest position change between updates that still counts as normal playback. */
  maxStepMs?: number;
}

export interface PlayTracker {
  readonly playId: string;
  onStartup(startupMs: number, rebufferMs?: number): void;
  onTimeUpdate(positionMs: number, playing: boolean): void;
  setHeight(height: number): void;
  onPause(): void;
  onEnded(): void;
  onHide(): void;
}

/**
 * Turns player time updates into analytics events. Watch time is playback that actually happened:
 * a jump larger than `maxStepMs` is a seek and adds nothing. Every call is safe, errors never reach the player.
 */
export function createPlayTracker(options: PlayTrackerOptions): PlayTracker {
  const viewAfterMs = options.viewAfterMs ?? 3000;
  const heartbeatMs = options.heartbeatMs ?? 10_000;
  const finishFraction = options.finishFraction ?? 0.95;
  const maxStepMs = options.maxStepMs ?? 2500;
  const playId = (options.randomUUID ?? (() => crypto.randomUUID()))();

  let watchedMs = 0;
  let lastPosition: number | null = null;
  let viewSent = false;
  let completeSent = false;
  let lastHeartbeatAt = 0;
  let lastSentWatched = 0;
  let maxHeight: number | undefined;
  let positionMs = 0;

  const emit = (event: AnalyticsEvent): void => {
    try {
      options.track(event);
    } catch {
      // Event write failure never affects playback.
    }
  };
  const base = () => ({ playId, videoId: options.videoId });
  const heightField = () => (maxHeight === undefined ? {} : { maxHeight });

  const sendView = (): void => {
    if (viewSent) return;
    viewSent = true;
    emit({ kind: 'view_start', ...base(), ...heightField() });
  };
  const sendProgress = (): void => {
    if (!viewSent || watchedMs === lastSentWatched) return;
    lastSentWatched = watchedMs;
    emit({ kind: 'progress', ...base(), watchedMs, positionMs, ...heightField() });
  };
  const sendComplete = (): void => {
    if (completeSent) return;
    sendView();
    completeSent = true;
    emit({ kind: 'complete', ...base(), watchedMs, ...heightField() });
  };

  return {
    playId,
    onStartup(startupMs, rebufferMs) {
      emit({
        kind: 'startup',
        videoId: options.videoId,
        startupMs: Math.round(startupMs),
        ...(rebufferMs === undefined ? {} : { rebufferMs: Math.round(rebufferMs) }),
      });
    },
    setHeight(height) {
      maxHeight = Math.max(maxHeight ?? 0, height);
    },
    onTimeUpdate(position, playing) {
      positionMs = Math.max(0, Math.round(position));
      if (!playing) {
        lastPosition = position;
        return;
      }
      if (lastPosition !== null) {
        const step = position - lastPosition;
        if (step > 0 && step <= maxStepMs) watchedMs += Math.round(step);
      }
      lastPosition = position;
      watchedMs = Math.min(watchedMs, 6 * 60 * 60 * 1000);
      if (!viewSent && watchedMs >= viewAfterMs) sendView();
      if (viewSent && watchedMs - lastHeartbeatAt >= heartbeatMs) {
        lastHeartbeatAt = Math.floor(watchedMs / heartbeatMs) * heartbeatMs;
        sendProgress();
      }
      if (options.durationMs > 0 && position >= options.durationMs * finishFraction) sendComplete();
    },
    onPause: sendProgress,
    onHide: sendProgress,
    onEnded() {
      sendComplete();
      sendProgress();
    },
  };
}
