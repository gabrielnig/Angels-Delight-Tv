import type { PlaybackSession, ProgressSink, SessionProvider } from '@ad/player';
import type { KeyValueStore } from './preferences';

const FIXTURE_TOKEN = 'fixture-token';

/**
 * Stands in for POST /api/play/{id}/session until the video lane's routes are wired in.
 * Serves the sample streams made by scripts/make-sample-hls.sh.
 */
export function createFixtureSessionProvider(appOrigin: string): SessionProvider {
  return {
    async createSession(videoId): Promise<PlaybackSession> {
      const set = videoId === 'v-encrypted' ? 'enc' : 'plain';
      return {
        token: FIXTURE_TOKEN,
        expiresAt: Date.now() + 30 * 60_000,
        masterUrl: `${appOrigin}/fixtures/hls/${set}/master.m3u8`,
      };
    },
  };
}

const progressKey = (profileId: string, videoId: string) => `ad.progress.${profileId}.${videoId}`;

export function readLocalProgress(
  store: KeyValueStore | null,
  profileId: string,
  videoId: string,
): { positionSeconds: number; finished: boolean } | null {
  try {
    const raw = store?.getItem(progressKey(profileId, videoId));
    if (!raw) return null;
    const v = JSON.parse(raw) as { positionSeconds?: unknown; finished?: unknown };
    if (typeof v.positionSeconds !== 'number') return null;
    return { positionSeconds: v.positionSeconds, finished: v.finished === true };
  } catch {
    return null;
  }
}

/** Fixture progress sink: the newest write per profile and video, kept on this device. */
export function createLocalProgressSink(store: KeyValueStore | null): ProgressSink {
  return {
    async save(update) {
      try {
        store?.setItem(
          progressKey(update.profileId, update.videoId),
          JSON.stringify({ positionSeconds: update.positionSeconds, finished: update.ended }),
        );
      } catch {
        // Storage blocked: nothing to do in fixture mode.
      }
    },
  };
}
