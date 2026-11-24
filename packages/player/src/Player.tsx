'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { PlayerController } from './controller';
import type { NetworkMonitor, PageEvents, PlayerEngine } from './engine';
import type { CaptionStyle } from './captionStyle';
import { readBandwidthSeed, saveBandwidth } from './bandwidth';
import { createPlayerEngine } from './hlsEngine';
import type { ProgressSink } from './progress';
import { readNetworkHints, type NetworkHints } from './quality';
import type { PlayerChapter } from './chapters';
import type { PlayerMarkers } from './markers';
import type { ResumeInput } from './resume';
import { TokenManager, type PlaybackSession, type SessionProvider } from './token';
import type {
  CaptionTrack,
  MetricsSink,
  PlaybackTelemetry,
  PlayerPreferences,
  UpNextItem,
} from './types';
import type { EndScreenData } from './ui/EndScreen';
import type { OverlayLinks } from './ui/Overlays';
import { PlayerView } from './ui/PlayerView';

export interface PlayerProps {
  videoId: string;
  profileId: string;
  title: string;
  posterUrl?: string;
  captionStyle?: CaptionStyle;
  /** Origin that serves playlists and keys, for example https://tv.example.org. */
  appOrigin: string;
  sessionProvider: SessionProvider;
  /** A session minted on the server for the first paint. Without it the player mints one on mount. */
  initialSession?: PlaybackSession;
  progressSink: ProgressSink;
  captions?: CaptionTrack[];
  /** Seek preview map (WebVTT of sprite tiles). Fetched on first hover, never with Data saver. */
  spriteUrl?: string | null;
  resume?: Omit<ResumeInput, 'rewind' | 'minSaved'>;
  /** Skip windows and chapters in seconds. They arrive with the page (M43). */
  markers?: PlayerMarkers;
  chapters?: PlayerChapter[];
  preferences?: Partial<PlayerPreferences>;
  onPreferencesChange?: (preferences: PlayerPreferences) => void;
  next?: UpNextItem | null;
  onNext?: (item: UpNextItem) => void;
  end?: EndScreenData;
  links?: OverlayLinks & { playbackSettings?: string };
  onSignIn?: () => void;
  onForbidden?: () => void;
  metrics?: MetricsSink;
  telemetry?: PlaybackTelemetry;
  deviceClass?: string;
  hints?: NetworkHints;
  autoplay?: boolean;
  countdownSeconds?: number;
  dataSaverMaxHeight?: number;
  /** Test seam: supply an engine instead of hls.js. */
  createEngine?: (video: HTMLVideoElement) => Promise<PlayerEngine>;
  /** Test seam: supply network and page event sources. */
  network?: NetworkMonitor;
  page?: PageEvents;
}

function deviceStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

const browserNetwork: NetworkMonitor = {
  isOnline: () => (typeof navigator === 'undefined' ? true : navigator.onLine),
  subscribe(listener) {
    const on = () => listener(true);
    const off = () => listener(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  },
};

const browserPage: PageEvents = {
  onVisibility(listener) {
    const h = () => listener(document.visibilityState === 'hidden');
    document.addEventListener('visibilitychange', h);
    return () => document.removeEventListener('visibilitychange', h);
  },
  onPageHide(listener) {
    window.addEventListener('pagehide', listener);
    return () => window.removeEventListener('pagehide', listener);
  },
};

function shortReference(): string {
  return Date.now().toString(36).slice(-6).toUpperCase();
}

/**
 * The player: a video element, hls.js (or native HLS), the controller and the custom controls.
 * Everything with side effects (sessions, progress, preferences, navigation) comes in through props.
 */
export function Player(props: PlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [controller, setController] = useState<PlayerController | null>(null);
  const reference = useMemo(shortReference, []);
  const latest = useRef(props);
  latest.current = props;
  const { videoId, profileId, appOrigin, initialSession } = props;

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let cancelled = false;
    let created: PlayerController | null = null;
    let tokens: TokenManager | null = null;

    (async () => {
      const p = latest.current;
      let controllerRef: PlayerController | null = null;
      tokens = new TokenManager({
        videoId,
        provider: p.sessionProvider,
        ...(initialSession ? { initial: initialSession } : {}),
        onFailure: (e) => controllerRef?.handleSessionFailure(e),
      });
      if (!initialSession) {
        try {
          await tokens.refresh();
        } catch {
          // The controller reports the failure when it loads without a token.
        }
      }
      const engine = await (p.createEngine
        ? p.createEngine(video)
        : createPlayerEngine({
            video,
            appOrigin,
            getToken: () => tokens?.token ?? null,
            initialBandwidth: readBandwidthSeed(deviceStorage()),
            onBandwidth: (bps) => saveBandwidth(deviceStorage(), bps),
          }));
      if (cancelled) {
        engine.destroy();
        return;
      }
      const c = new PlayerController({
        media: video,
        engine,
        tokens,
        videoId,
        profileId,
        sink: p.progressSink,
        network: p.network ?? browserNetwork,
        page: p.page ?? browserPage,
        hints: p.hints ?? readNetworkHints(),
        ...(p.preferences ? { preferences: p.preferences } : {}),
        ...(p.captions ? { captions: p.captions } : {}),
        ...(p.resume ? { resume: p.resume } : {}),
        ...(p.markers ? { markers: p.markers } : {}),
        ...(p.chapters ? { chapters: p.chapters } : {}),
        ...(p.next !== undefined ? { upNext: p.next } : {}),
        ...(p.metrics ? { metrics: p.metrics } : {}),
        ...(p.telemetry ? { telemetry: p.telemetry } : {}),
        ...(p.deviceClass ? { deviceClass: p.deviceClass } : {}),
        ...(p.autoplay !== undefined ? { autoplay: p.autoplay } : {}),
        ...(p.countdownSeconds ? { countdownSeconds: p.countdownSeconds } : {}),
        ...(p.dataSaverMaxHeight ? { dataSaverMaxHeight: p.dataSaverMaxHeight } : {}),
        onPreferencesChange: (prefs) => latest.current.onPreferencesChange?.(prefs),
        onNext: (item) => latest.current.onNext?.(item),
        onUnauthorized: () => latest.current.onSignIn?.(),
        onForbidden: () => latest.current.onForbidden?.(),
      });
      controllerRef = c;
      created = c;
      c.start();
      setController(c);
    })();

    return () => {
      cancelled = true;
      created?.dispose();
      tokens?.dispose();
      setController(null);
    };
  }, [videoId, profileId, appOrigin, initialSession]);

  return (
    <PlayerView
      controller={controller}
      title={props.title}
      posterUrl={props.posterUrl}
      captionStyle={props.captionStyle}
      videoRef={videoRef}
      next={props.next ?? null}
      {...(props.end ? { end: props.end } : {})}
      {...(props.links ? { links: props.links } : {})}
      {...(props.onSignIn ? { onSignIn: props.onSignIn } : {})}
      reference={reference}
      spriteUrl={props.spriteUrl ?? null}
      {...(props.chapters ? { chapters: props.chapters } : {})}
      autoplayNext={props.preferences?.autoplayNext ?? false}
      {...(props.countdownSeconds ? { countdownSeconds: props.countdownSeconds } : {})}
    />
  );
}
