'use client';

import {
  createHttpProgressSink,
  createHttpSessionProvider,
  Player,
  type EndScreenData,
  type PlayerPreferences,
  type PlayerProps,
  type UpNextItem,
} from '@ad/player';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { PlaybackTransport, WatchData } from '@/lib/data/playback';
import {
  createFixtureSessionProvider,
  createLocalProgressSink,
  readLocalProgress,
} from './fixture-adapters';
import { getAnalyticsClient } from '@/lib/analytics/browser';
import { createWatchTelemetry } from './telemetry';
import { toViewerProgressBody } from './progress-body';
import { loadPreferences, savePreferences } from './preferences';
import {
  BROWSE_PATH,
  HELP_PATH,
  HOME_PATH,
  PLAYBACK_SETTINGS_PATH,
  PROGRESS_ENDPOINT,
  signInPath,
  watchPath,
} from './routes';
import { useOnline } from './useOnline';
import { WatchActions } from './WatchActions';

export interface WatchClientProps {
  data: WatchData;
  viewer: { profileId: string; kids: boolean };
  transport: PlaybackTransport;
  /** Where progress goes when it differs from the session transport. Real viewer data always posts to /api/progress. */
  progressTransport?: PlaybackTransport;
  /** Value of ?t= in seconds, overrides the saved position for this load. */
  startAt: number | null;
  /** Details rendered between the player and the action buttons. */
  children?: ReactNode;
  /** Test seams passed straight to the player. */
  testing?: Pick<PlayerProps, 'createEngine' | 'network' | 'page' | 'hints' | 'autoplay'>;
}

function storage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

function OfflineScreen({ backHref }: { backHref: string }) {
  return (
    <div className="watch__offline" role="alert">
      <h2>You are offline</h2>
      <p>Connect to the internet to watch. Your place is saved.</p>
      <a className="watch__button" href={backHref}>
        Back
      </a>
    </div>
  );
}

/** Screens 21 and 22: the player and its wiring to sessions, progress, preferences and navigation. */
export function WatchClient({
  data,
  viewer,
  transport,
  progressTransport = transport,
  startAt,
  children,
  testing,
}: WatchClientProps) {
  const router = useRouter();
  const online = useOnline();
  const [origin, setOrigin] = useState<string | null>(null);
  useEffect(() => setOrigin(window.location.origin), []);

  const { video } = data;
  const sessionProvider = useMemo(() => {
    if (!origin) return null;
    return transport === 'http'
      ? createHttpSessionProvider({ appOrigin: origin, profileId: viewer.profileId })
      : createFixtureSessionProvider(origin);
  }, [origin, transport, viewer.profileId]);

  const progressSink = useMemo(
    () =>
      progressTransport === 'http'
        ? createHttpProgressSink({ endpoint: PROGRESS_ENDPOINT, toBody: toViewerProgressBody })
        : createLocalProgressSink(storage()),
    [progressTransport],
  );

  const preferences = useMemo(
    () => loadPreferences(storage(), viewer.profileId, { kids: viewer.kids }, data.preferences),
    // The server defaults are part of this video's data, so they cannot change while the player is open.
    [viewer.profileId, viewer.kids],
  );
  const onPreferencesChange = useCallback(
    (prefs: PlayerPreferences) => savePreferences(storage(), viewer.profileId, prefs),
    [viewer.profileId],
  );

  const resume = useMemo(() => {
    const local =
      progressTransport === 'fixture'
        ? readLocalProgress(storage(), viewer.profileId, video.id)
        : null;
    const saved = local ?? data.saved;
    return {
      urlT: startAt,
      saved: saved?.positionSeconds ?? null,
      finished: saved?.finished ?? false,
      duration: video.durationSeconds,
    };
    // Evaluated once per video: the saved position must not move while watching.
  }, [video.id]);

  const telemetry = useMemo(() => {
    if (!origin) return undefined;
    try {
      return createWatchTelemetry({
        videoId: video.id,
        durationSeconds: video.durationSeconds,
        client: getAnalyticsClient(),
      });
    } catch {
      return undefined;
    }
  }, [origin, video.id, video.durationSeconds]);

  const onNext = useCallback((item: UpNextItem) => router.push(watchPath(item.id)), [router]);

  const end: EndScreenData = {
    ...(video.series
      ? { seriesTitle: video.series.title, lastInSeries: video.series.lastEpisode }
      : {}),
    related: data.related,
    inMyList: data.inMyList,
    backHref: video.backHref,
    backLabel: video.series ? 'Back to the series' : 'Back',
    homeHref: HOME_PATH,
    browseHref: BROWSE_PATH,
  };

  if (!online) {
    return (
      <>
        <OfflineScreen backHref={video.backHref} />
        {children}
      </>
    );
  }

  return (
    <>
      <div className="watch__player">
        {origin && sessionProvider ? (
          <Player
            videoId={video.id}
            profileId={viewer.profileId}
            title={video.title}
            {...(video.posterUrl ? { posterUrl: video.posterUrl } : {})}
            appOrigin={origin}
            sessionProvider={sessionProvider}
            progressSink={progressSink}
            captions={data.captions}
            spriteUrl={data.spriteUrl ?? null}
            resume={resume}
            preferences={preferences}
            onPreferencesChange={onPreferencesChange}
            next={data.next}
            onNext={onNext}
            end={end}
            links={{
              signIn: signInPath(watchPath(video.id)),
              browse: BROWSE_PATH,
              help: HELP_PATH,
              playbackSettings: PLAYBACK_SETTINGS_PATH,
            }}
            onForbidden={() => router.push('/profiles')}
            {...(telemetry ? { telemetry } : {})}
            deviceClass={viewer.kids ? 'kids' : 'standard'}
            {...testing}
          />
        ) : (
          <div className="watch__placeholder" aria-hidden="true" />
        )}
      </div>
      {children}
      <WatchActions videoId={video.id} title={video.title} initialInMyList={data.inMyList} />
    </>
  );
}
