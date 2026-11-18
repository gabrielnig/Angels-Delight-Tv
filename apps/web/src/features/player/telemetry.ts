import { createPlayTracker, type AnalyticsClient } from '@ad/analytics/client';
import type { PlaybackTelemetry } from '@ad/player';

type AnalyticsTrack = AnalyticsClient['track'];

const CODE = /^[a-z0-9][a-z0-9._-]{0,39}$/;

/**
 * Feeds the player's playback facts into the analytics client: views, watch time, completion and startup
 * through the play tracker, and error codes as their own events. Everything is best effort (M08-S30 AC2).
 */
export function createWatchTelemetry(options: {
  videoId: string;
  durationSeconds: number;
  client: { track: AnalyticsTrack };
}): PlaybackTelemetry {
  const { client, videoId } = options;
  const safe = (fn: () => void): void => {
    try {
      fn();
    } catch {
      // Analytics never reaches the viewer.
    }
  };
  const tracker = createPlayTracker({
    videoId,
    durationMs: Math.max(0, Math.round(options.durationSeconds * 1000)),
    track: (event) => client.track(event),
  });
  return {
    onStartup: (ms, rebufferMs) => safe(() => tracker.onStartup(ms, rebufferMs)),
    onTimeUpdate: (ms, playing) => safe(() => tracker.onTimeUpdate(ms, playing)),
    onPause: () => safe(() => tracker.onPause()),
    onEnded: () => safe(() => tracker.onEnded()),
    onHide: () => safe(() => tracker.onHide()),
    setHeight: (h) => safe(() => tracker.setHeight(h)),
    onError: (code) => {
      if (!CODE.test(code)) return;
      safe(() => client.track({ kind: 'error', code, videoId }));
    },
  };
}
