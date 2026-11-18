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
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { PlaybackTransport, WatchData } from '@/lib/data/playback';
import {
  createFixtureSessionProvider,
  createLocalProgressSink,
  readLocalProgress,
} from './fixture-adapters';
import { getAnalyticsClient } from '@/lib/analytics/browser';
import { createWatchMetrics, createWatchTelemetry } from './telemetry';
import { toViewerProgressBody } from './progress-body';
import {
  clearLegacyPreferences,
  loadPreferences,
  readLegacyPreferences,
  savePreferences,
  serverChanges,
  type ServerPatch,
} from './preferences';
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
  /**
   * Where speed, captions, data saver and autoplay are kept for the profile (M03-S09). Without it they are not
   * saved. `migrate` moves what an older version kept in this browser, once.
   */
  prefsSync?: {
    save(profileId: string, patch: ServerPatch): Promise<unknown>;
    migrate(
      profileId: string,
      legacy: ServerPatch,
    ): Promise<{
      speed: number;
      captionsDefault: boolean;
      captionLanguage: string;
      dataSaver: boolean;
      autoplayNext: boolean;
    }>;
  };
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
  prefsSync,
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

  // Choices an older version kept in this browser move to the profile before the player starts (M03-S09).
  const [serverPrefs, setServerPrefs] = useState(data.preferences);
  const [prefsReady, setPrefsReady] = useState(false);
  useEffect(() => {
    const legacy = prefsSync ? readLegacyPreferences(storage(), viewer.profileId) : null;
    if (!prefsSync || !legacy) {
      setPrefsReady(true);
      return;
    }
    let cancelled = false;
    prefsSync
      .migrate(viewer.profileId, legacy)
      .then((saved) => {
        if (cancelled) return;
        setServerPrefs((current) => ({
          ...current,
          rate: saved.speed,
          captionsOn: viewer.kids || saved.captionsDefault,
          captionLanguage: saved.captionLanguage,
          dataSaver: saved.dataSaver,
          autoplayNext: saved.autoplayNext,
        }));
        clearLegacyPreferences(storage(), viewer.profileId);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setPrefsReady(true);
      });
    return () => {
      cancelled = true;
    };
    // Once per profile on this page.
  }, [viewer.profileId]);

  const preferences = useMemo(
    () => loadPreferences(storage(), viewer.profileId, { kids: viewer.kids }, serverPrefs),
    // Server values cannot change while the player is open, only before it starts.
    [viewer.profileId, viewer.kids, serverPrefs],
  );
  const lastSynced = useRef<PlayerPreferences | null>(null);
  const onPreferencesChange = useCallback(
    (prefs: PlayerPreferences) => {
      savePreferences(storage(), viewer.profileId, prefs);
      const patch = serverChanges(lastSynced.current ?? preferences, prefs);
      if (Object.keys(patch).length === 0) return;
      lastSynced.current = prefs;
      void prefsSync?.save(viewer.profileId, patch)?.catch(() => undefined);
    },
    [viewer.profileId, preferences, prefsSync],
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

  const metrics = useMemo(() => {
    if (!origin) return undefined;
    try {
      return createWatchMetrics({ videoId: video.id, client: getAnalyticsClient() });
    } catch {
      return undefined;
    }
  }, [origin, video.id]);

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
        {origin && sessionProvider && prefsReady ? (
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
            captionStyle={data.captionStyle}
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
            {...(metrics ? { metrics } : {})}
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
