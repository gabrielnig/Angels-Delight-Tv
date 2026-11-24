import type { ActiveChapter } from './chapters';
import type { ActiveMarker } from './markers';
import type { QualityMenu, QualitySelection } from './quality';

export interface CaptionTrack {
  id: string;
  /** BCP 47 language tag, for example "en". */
  language: string;
  /** Name in its own language, for example "English", "Yoruba". */
  label: string;
  /** Signed WebVTT URL, same access rules as the video. */
  src: string;
  /** Anything other than "approved" is never attached (M11-S01). */
  status: 'approved' | 'needs_review' | 'rejected' | 'draft' | (string & {});
}

export const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;

export type PlayerErrorKind =
  | 'connection-lost'
  | 'offline'
  | 'session-expired'
  | 'removed'
  | 'cannot-play'
  | 'unsupported-browser';

export type PlayerPhase = 'loading' | 'ready' | 'ended' | 'error';

export interface PlayerToast {
  id: number;
  kind: 'resume' | 'info' | 'error';
  message: string;
  /** "start-over" shows the Start over action on a resume toast. */
  action?: 'start-over';
}

export interface UpNextState {
  /** The small "Next: title" tile during the last 15 seconds. */
  tile: boolean;
  /** Seconds left in the autoplay countdown, null when none is running. */
  countdown: number | null;
  /** The viewer pressed Cancel on the countdown. */
  cancelled: boolean;
  /** Three autoplays ran with no input, so the end screen asks "Still watching?" and waits (R15). */
  stillWatching: boolean;
}

export interface PlayerCaptionState {
  available: boolean;
  tracks: CaptionTrack[];
  active: string | null;
}

export interface PlayerQualityState {
  menu: QualityMenu;
  selected: QualitySelection;
  currentHeight: number | null;
  dataSaver: boolean;
}

export interface PlayerState {
  phase: PlayerPhase;
  playing: boolean;
  /** Spinner on screen (stall over 500 ms, or first frame pending over 500 ms). */
  buffering: boolean;
  /** "Slow connection. Switching to lower quality" is showing. */
  slowNotice: boolean;
  error: PlayerErrorKind | null;
  currentTime: number;
  duration: number;
  bufferedEnd: number;
  volume: number;
  muted: boolean;
  rate: number;
  captions: PlayerCaptionState;
  quality: PlayerQualityState;
  toast: PlayerToast | null;
  upNext: UpNextState;
  /** False when the video has no audio track, so the volume controls are hidden (M08-S05). */
  hasAudio: boolean;
  /** The network came back while the player was stopped by it. */
  backOnline: boolean;
  /** The skip window the viewer is inside, or null (M43). */
  marker: ActiveMarker | null;
  /** The chapter the viewer is in, or null before the first one or with no chapters. */
  chapter: ActiveChapter | null;
  /** Autoplay next is on for this viewer. The Settings switch changes it at once, so the end screen follows. */
  autoplayNext: boolean;
  /** Text for the polite live region. */
  announce: string;
}

/** Preferences the host stores per profile (M03, M08-S05, M08-S10, M11-S02). */
export interface PlayerPreferences {
  volume: number;
  muted: boolean;
  rate: number;
  captionsOn: boolean;
  captionLanguage: string;
  dataSaver: boolean;
  autoplayNext: boolean;
}

export const DEFAULT_PREFERENCES: PlayerPreferences = {
  volume: 1,
  muted: false,
  rate: 1,
  captionsOn: false,
  captionLanguage: 'en',
  dataSaver: false,
  autoplayNext: false,
};

export interface UpNextItem {
  id: string;
  title: string;
  posterUrl?: string;
  /** Line under the title, for example "Everyday Science, S1 E4, 5 min". */
  meta?: string;
}

export interface PlaybackMetrics {
  startupMs: number | null;
  rebufferCount: number;
  rebufferMs: number;
  errors: string[];
  averageBitrate: number | null;
  deviceClass: string;
  final: boolean;
}

export interface MetricsSink {
  report(metrics: PlaybackMetrics): void;
}

/**
 * Where playback facts go for analytics and the player quality dashboard (M08-S30, M24-S04). Mirrors the
 * play tracker in @ad/analytics so the web app can pass one straight in. Times are milliseconds.
 */
export interface PlaybackTelemetry {
  onStartup(startupMs: number, rebufferMs?: number): void;
  onTimeUpdate(positionMs: number, playing: boolean): void;
  onPause(): void;
  onEnded(): void;
  onHide(): void;
  setHeight(height: number): void;
  /** A code such as `player.network`. Never a message. */
  onError(code: string): void;
  /** The viewer used a Skip button or the S key. Positions in milliseconds. */
  onSkip?(kind: 'intro' | 'recap' | 'credits' | 'next', fromMs: number, toMs: number): void;
}
