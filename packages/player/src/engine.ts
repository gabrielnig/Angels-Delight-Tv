import type { QualitySelection } from './quality';

/** The subset of HTMLVideoElement the controller uses. A real video element satisfies it. */
export interface PlayerMedia extends EventTarget {
  currentTime: number;
  readonly duration: number;
  readonly paused: boolean;
  readonly ended: boolean;
  volume: number;
  muted: boolean;
  playbackRate: number;
  readonly buffered: { length: number; start(i: number): number; end(i: number): number };
  readonly error: { code: number } | null;
  play(): Promise<void>;
  pause(): void;
}

export type EngineErrorKind = 'network' | 'auth' | 'forbidden' | 'gone' | 'media' | 'unsupported';

export interface EngineError {
  kind: EngineErrorKind;
  /** Fatal means the engine gave up retrying by itself. */
  fatal: boolean;
  status?: number;
  detail: string;
}

export type EngineEvent =
  | { type: 'levels'; heights: number[]; /** False when the renditions carry no audio. Omitted when unknown. */ audio?: boolean }
  | { type: 'level'; height: number; bitrate?: number }
  | { type: 'error'; error: EngineError };

export interface EngineLoadOptions {
  src: string;
  startPosition: number;
  /** Save-Data or a slow connection: start on 360p. */
  lowData: boolean;
  cap: number | null;
}

/** What the controller needs from a streaming engine. Implemented by hls.js, native HLS and test fakes. */
export interface PlayerEngine {
  readonly name: string;
  load(opts: EngineLoadOptions): void;
  /** Reload from the top with a fresh token so playlists carry new signatures. */
  reload(startPosition: number): void;
  /** Resume fetching after a network failure. */
  recover(): void;
  /** Resume after a decode failure. */
  recoverMedia(): void;
  setQuality(selection: QualitySelection, cap: number | null): void;
  /** Step down one rendition. Returns false when already on the lowest. */
  dropQuality(): boolean;
  /** Start time of the segment containing `time`, when the engine knows its playlist. */
  segmentStart?(time: number): number | null;
  setToken(token: string | null): void;
  on(listener: (event: EngineEvent) => void): () => void;
  destroy(): void;
}

export interface NetworkMonitor {
  isOnline(): boolean;
  subscribe(listener: (online: boolean) => void): () => void;
}

export interface PageEvents {
  /** Fires with true when the tab hides. */
  onVisibility(listener: (hidden: boolean) => void): () => void;
  onPageHide(listener: () => void): () => void;
}
