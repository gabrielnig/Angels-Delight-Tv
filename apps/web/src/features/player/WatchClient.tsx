'use client';

import {
  createHttpProgressSink,
  createHttpSessionProvider,
  Player,
  type CaptionStyle,
  type EndScreenData,
  type PlayerPreferences,
  type PlayerProps,
  type UpNextItem,
} from '@ad/player';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { msg } from '@ad/shared/messages';
import type { ProgressTransport, PlaybackTransport, WatchData } from '@/lib/data/playback';
import {
  createGuestProgressSink,
  firstUnfinished,
  readGuestProgress,
} from '@/lib/guest/progress-store';
import {
  createFixtureSessionProvider,
  createLocalProgressSink,
  readLocalProgress,
} from './fixture-adapters';
import { getAnalyticsClient } from '@/lib/analytics/browser';
import { createAutoplayStreak } from './autoplay-streak';
import { createWatchMetrics, createWatchTelemetry } from './telemetry';
import { toViewerProgressBody } from './progress-body';
import {
  captionStylePatch,
  clearLegacyPreferences,
  loadPreferences,
  readCaptionStyle,
  readLegacyPreferences,
  readTheatre,
  saveCaptionStyle,
  savePreferences,
  saveTheatre,
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
import { challengeKeyFor, useGuestChallenge } from './useGuestChallenge';
import { WatchActions } from './WatchActions';

export interface WatchClientProps {
  data: WatchData;
  /** A guest has no profile: the session carries no profile id, progress and preferences stay on this device. */
  viewer: { profileId: string; kids: boolean; guest?: true };
  /** Whether the Sign in to save dialog offers Create account. Only read for guests. */
  signUpOpen?: boolean;
  /** The Turnstile site key. With it a visitor can pass the check when the server asks for one (M40-S11). */
  challengeSiteKey?: string;
  transport: PlaybackTransport;
  /** Where progress goes when it differs from the session transport. Real viewer data always posts to /api/progress. */
  progressTransport?: ProgressTransport;
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
  /** Seconds the next video waits (site setting `playback.countdown_seconds`, 5 to 10). */
  countdownSeconds?: number | undefined;
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
  prefsSync: prefsSyncProp,
  countdownSeconds,
  testing,
  signUpOpen,
  challengeSiteKey,
}: WatchClientProps) {
  const challenge = useGuestChallenge(challengeKeyFor(viewer, challengeSiteKey));
  const router = useRouter();
  const playerBox = useRef<HTMLDivElement>(null);
  const [theatre, setTheatre] = useState(false);
  useEffect(() => setTheatre(readTheatre(storage())), []);
  useEffect(() => {
    // The watch page owns the layout, so the attribute goes on the page element the CSS targets.
    const layout = playerBox.current?.closest('.watch');
    layout?.setAttribute('data-theatre', theatre ? 'on' : 'off');
  }, [theatre]);
  const toggleTheatre = useCallback(() => {
    setTheatre((on) => {
      saveTheatre(storage(), !on);
      return !on;
    });
  }, []);
  const online = useOnline();
  const [origin, setOrigin] = useState<string | null>(null);
  useEffect(() => setOrigin(window.location.origin), []);

  const { video } = data;
  const isGuest = viewer.guest === true;
  // A guest never writes to the server and never syncs preferences, whatever the page passed in (M40-S04).
  const progressMode: ProgressTransport = isGuest ? 'local' : progressTransport;
  const prefsSync = isGuest ? undefined : prefsSyncProp;
  const [unsaved, setUnsaved] = useState(false);
  const sessionProvider = useMemo(() => {
    if (!origin) return null;
    if (transport !== 'http') return createFixtureSessionProvider(origin);
    return createHttpSessionProvider({
      appOrigin: origin,
      ...(isGuest ? {} : { profileId: viewer.profileId }),
      ...(challenge.solve ? { solveChallenge: challenge.solve } : {}),
    });
  }, [origin, transport, viewer.profileId, isGuest, challenge.solve]);

  const progressSink = useMemo(
    () =>
      progressMode === 'local'
        ? createGuestProgressSink(storage(), { onUnavailable: () => setUnsaved(true) })
        : progressMode === 'http'
          ? createHttpProgressSink({ endpoint: PROGRESS_ENDPOINT, toBody: toViewerProgressBody })
          : createLocalProgressSink(storage()),
    [progressMode],
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

  // A guest's finished titles live on this device, so the server sends the ordered choices (M08-S13 AC4).
  const nextTitle = useMemo(() => {
    if (!isGuest || !data.nextCandidates) return data.next;
    return firstUnfinished(storage(), data.nextCandidates);
  }, [isGuest, data.next, data.nextCandidates]);

  // The profile keeps the caption style for an account with sync. A guest, or a profile with nowhere to save,
  // keeps it on this device (L4-07).
  const styleKey = isGuest ? 'guest' : viewer.profileId;
  const [captionStyle, setCaptionStyle] = useState<CaptionStyle>(data.captionStyle);
  const savedStyle = useRef<CaptionStyle>(data.captionStyle);
  useEffect(() => {
    if (prefsSync) return;
    const local = readCaptionStyle(storage(), styleKey);
    if (!local) return;
    savedStyle.current = local;
    setCaptionStyle(local);
  }, [prefsSync, styleKey]);
  const onCaptionStyleChange = useCallback(
    (next: CaptionStyle) => {
      setCaptionStyle(next);
      if (!prefsSync) {
        saveCaptionStyle(storage(), styleKey, next);
        savedStyle.current = next;
        return;
      }
      const before = captionStylePatch(savedStyle.current);
      const after = captionStylePatch(next);
      const patch = Object.fromEntries(
        Object.entries(after).filter(([key, value]) => before[key as keyof ServerPatch] !== value),
      ) as ServerPatch;
      savedStyle.current = next;
      if (Object.keys(patch).length === 0) return;
      void prefsSync.save(viewer.profileId, patch)?.catch(() => undefined);
    },
    [prefsSync, styleKey, viewer.profileId],
  );

  const resume = useMemo(() => {
    const guestPlace = isGuest ? readGuestProgress(storage(), video.id) : null;
    const local =
      guestPlace !== null
        ? { positionSeconds: guestPlace.p, finished: guestPlace.f }
        : progressMode === 'fixture'
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

  // Never called with Data saver on, so the next page is only fetched when the viewer or the countdown goes there.
  const prefetchNext = useCallback(
    (item: UpNextItem) => router.prefetch(watchPath(item.id)),
    [router],
  );
  const autoplayStreak = useMemo(() => {
    let store: Storage | null = null;
    try {
      store = typeof window === 'undefined' ? null : window.sessionStorage;
    } catch {
      store = null;
    }
    return createAutoplayStreak(store);
  }, []);
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
      {unsaved ? (
        <p className="watch__note" role="status">
          {msg('guest.progress.notSaved')}
        </p>
      ) : null}
      <div className="watch__player" ref={playerBox}>
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
            theatre={theatre}
            onTheatreToggle={toggleTheatre}
            {...(data.markers ? { markers: data.markers } : {})}
            {...(data.chapters ? { chapters: data.chapters } : {})}
            captionStyle={captionStyle}
            onCaptionStyleChange={onCaptionStyleChange}
            resume={resume}
            preferences={preferences}
            onPreferencesChange={onPreferencesChange}
            next={nextTitle}
            {...(countdownSeconds ? { countdownSeconds } : {})}
            prefetchNext={prefetchNext}
            autoplayStreak={autoplayStreak}
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
      {challenge.element}
      <WatchActions
        videoId={video.id}
        title={video.title}
        initialInMyList={data.inMyList}
        guest={viewer.guest ? { signUpOpen: signUpOpen ?? false } : undefined}
      />
    </>
  );
}
