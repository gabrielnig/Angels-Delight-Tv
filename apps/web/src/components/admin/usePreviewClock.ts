'use client';

import {
  PlayerController,
  TokenManager,
  createPlayerEngine,
  type PlayerEngine,
  type ProgressSink,
  type SessionProvider,
} from '@ad/player';
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { createPreviewSessionProvider } from '@/lib/admin/preview-session';

export interface PreviewClock {
  /** Position in milliseconds. */
  ms: number;
  playing: boolean;
  toggle(): void;
  seek(ms: number): void;
  /** off: no preview asked for. loading and ready: the real player. unavailable: it could not start, so the simulated clock runs. */
  status: 'off' | 'loading' | 'ready' | 'unavailable';
  /** Attach to a `<video>` element when `status` is not `off`. */
  videoRef: RefObject<HTMLVideoElement | null>;
}

interface Options {
  videoId: string;
  durationMs: number;
  /** True when the server can mint preview sessions for this video. */
  enabled: boolean;
  appOrigin: string;
  /** Test seams. */
  sessionProvider?: SessionProvider;
  createEngine?: (video: HTMLVideoElement) => Promise<PlayerEngine>;
}

const noProgress: ProgressSink = { save: async () => undefined };

/**
 * The playhead for caption review. With a preview session it is the real player (`@ad/player`, the same
 * controller viewers use, no viewer progress written). Without one it is a plain timer so the screen still works.
 */
export function usePreviewClock(options: Options): PreviewClock {
  const { videoId, durationMs, enabled } = options;
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controllerRef = useRef<PlayerController | null>(null);
  const latest = useRef(options);
  latest.current = options;

  const [status, setStatus] = useState<PreviewClock['status']>(enabled ? 'loading' : 'off');
  const [simMs, setSimMs] = useState(0);
  const [simPlaying, setSimPlaying] = useState(false);
  const [live, setLive] = useState({ ms: 0, playing: false });
  const liveOn = status === 'ready';

  useEffect(() => {
    if (!simPlaying || liveOn) return;
    const timer = setInterval(() => {
      setSimMs((current) => {
        if (current + 100 >= durationMs) {
          setSimPlaying(false);
          return durationMs;
        }
        return current + 100;
      });
    }, 100);
    return () => clearInterval(timer);
  }, [simPlaying, durationMs, liveOn]);

  useEffect(() => {
    if (!enabled) {
      setStatus('off');
      return;
    }
    const video = videoRef.current;
    if (!video) return;
    setStatus('loading');
    let cancelled = false;
    let controller: PlayerController | null = null;
    let tokens: TokenManager | null = null;
    let unsubscribe: (() => void) | null = null;

    (async () => {
      const o = latest.current;
      const provider =
        o.sessionProvider ?? createPreviewSessionProvider({ appOrigin: o.appOrigin });
      tokens = new TokenManager({
        videoId,
        provider,
        onFailure: () => {
          if (!cancelled) setStatus('unavailable');
        },
      });
      try {
        await tokens.refresh();
      } catch {
        if (!cancelled) setStatus('unavailable');
        return;
      }
      const manager = tokens;
      const engine = await (o.createEngine
        ? o.createEngine(video)
        : createPlayerEngine({
            video,
            appOrigin: o.appOrigin,
            getToken: () => manager.token ?? null,
          }));
      if (cancelled) {
        engine.destroy();
        return;
      }
      controller = new PlayerController({
        media: video,
        engine,
        tokens: manager,
        videoId,
        profileId: 'preview',
        sink: noProgress,
        autoplay: false,
      });
      controllerRef.current = controller;
      const read = () => {
        const state = controller!.getState();
        setLive({ ms: Math.round((state.currentTime || 0) * 1000), playing: state.playing });
      };
      unsubscribe = controller.subscribe(read);
      controller.start();
      read();
      setStatus('ready');
    })();

    return () => {
      cancelled = true;
      unsubscribe?.();
      controller?.dispose();
      tokens?.dispose();
      controllerRef.current = null;
    };
  }, [videoId, enabled]);

  const toggle = useCallback(() => {
    if (controllerRef.current && liveOn) controllerRef.current.toggle();
    else setSimPlaying((p) => !p);
  }, [liveOn]);

  const seek = useCallback(
    (value: number) => {
      const clamped = Math.max(0, Math.min(latest.current.durationMs, value));
      if (controllerRef.current && liveOn) controllerRef.current.seekTo(clamped / 1000);
      else setSimMs(clamped);
    },
    [liveOn],
  );

  return {
    ms: liveOn ? live.ms : simMs,
    playing: liveOn ? live.playing : simPlaying,
    toggle,
    seek,
    status,
    videoRef,
  };
}
