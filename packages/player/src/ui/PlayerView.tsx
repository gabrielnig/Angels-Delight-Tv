'use client';

import { msg, type Translate } from '@ad/shared/messages';
import { PlayerTProvider, usePlayerT } from '../t';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type Ref,
} from 'react';
import { normalizeChapters, type PlayerChapter } from '../chapters';
import { DEFAULT_CAPTION_STYLE, captionStyleVars, type CaptionStyle } from '../captionStyle';
import { clampCountdown, type PlayerController } from '../controller';
import { formatClock } from '../format';
import { TapTracker } from '../gestures';
import { resolveShortcut } from '../keyboard';
import type { UpNextItem } from '../types';
import { EndScreen, type EndScreenData } from './EndScreen';
import {
  AirplayIcon,
  Back10Icon,
  CaptionsIcon,
  ChaptersIcon,
  Forward10Icon,
  FullscreenExitIcon,
  FullscreenIcon,
  MutedIcon,
  PauseIcon,
  PipIcon,
  PlayIcon,
  SettingsIcon,
  TheatreIcon,
  VolumeIcon,
} from './icons';
import { CaptionAppearance } from './CaptionAppearance';
import { CaptionRows, ChapterRows, MenuShell, type MenuId } from './Menus';
import { SettingsMenu } from './SettingsMenu';
import { watchAirplayAvailability, watchWireless } from '../airplay';
import { inPip, pipSupported as pipSupportedBy, togglePip as pipToggle, watchPip } from '../pip';
import { ErrorOverlay, HintBar, Spinner, Toast, UpNextTile, type OverlayLinks } from './Overlays';
import { SeekBar } from './SeekBar';
import { SkipButton } from './SkipButton';
import { ShortcutsDialog } from './ShortcutsDialog';
import { useControllerState } from './useControllerState';
import { useMediaQuery } from './useMediaQuery';

export interface PlayerViewProps {
  controller: PlayerController | null;
  /** Translates player strings. Pass the same function to the controller. */
  t?: Translate | undefined;
  title: string;
  posterUrl?: string | undefined;
  /** Caption size, background and contrast for this profile (M11-S03). */
  captionStyle?: CaptionStyle | undefined;
  /** AirPlay button, off until the device spike passes (R16). Safari still has to report a device. */
  airplay?: boolean | undefined;
  /** A kids profile follows its grown up's autoplay choice, so the switch is shown but cannot be changed. */
  lockAutoplay?: boolean | undefined;
  /** Saves a changed caption style. Without it the Caption appearance entry is not offered. */
  onCaptionStyleChange?: ((style: CaptionStyle) => void) | undefined;
  videoRef?: Ref<HTMLVideoElement>;
  next?: UpNextItem | null;
  end?: EndScreenData;
  links?: OverlayLinks & { playbackSettings?: string };
  onSignIn?: () => void;
  /** Reference code shown on the "cannot play" screen. */
  reference?: string;
  autoplayNext?: boolean;
  countdownSeconds?: number;
  /** Seek preview map from the playback session. Ignored with Data saver on. */
  spriteUrl?: string | null;
  /** Chapters of this video (M43), also given to the controller. Empty or missing hides every chapter surface. */
  chapters?: PlayerChapter[];
  /** Theatre mode is a layout the watch page owns (M43-S08). Without a handler the button and the T key are off. */
  theatre?: boolean;
  onTheatreToggle?: (() => void) | undefined;
}

const HIDE_AFTER_MS = 3_000;

type FsVideo = HTMLVideoElement & { webkitEnterFullscreen?: () => void };

/** The player screen. Strings come from the `t` prop (the viewer's language), English when it is not given. */
export function PlayerView(props: PlayerViewProps) {
  return (
    <PlayerTProvider t={props.t ?? msg}>
      <PlayerViewInner {...props} />
    </PlayerTProvider>
  );
}

function PlayerViewInner(props: PlayerViewProps) {
  const msg = usePlayerT();
  const { controller, title, posterUrl, next = null, links = {}, reference = 'UNKNOWN' } = props;
  const state = useControllerState(controller);
  const containerRef = useRef<HTMLDivElement>(null);
  const videoEl = useRef<HTMLVideoElement | null>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const tapper = useRef(new TapTracker());
  const pointerType = useRef('mouse');
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rippleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playingRef = useRef(false);
  playingRef.current = state.playing;

  const [menu, setMenu] = useState<MenuId | null>(null);
  const [settingsStart, setSettingsStart] = useState<'quality' | undefined>(undefined);
  const [capStyle, setCapStyle] = useState<CaptionStyle>(
    props.captionStyle ?? DEFAULT_CAPTION_STYLE,
  );
  useEffect(() => {
    if (props.captionStyle) setCapStyle(props.captionStyle);
  }, [props.captionStyle]);
  const changeCaptionStyle = (next: CaptionStyle) => {
    setCapStyle(next);
    props.onCaptionStyleChange?.(next);
  };
  const openCaptionStyle = () => setMenu('captionStyle');
  const [helpOpen, setHelpOpen] = useState(false);
  const [shown, setShown] = useState(true);
  const [focusInside, setFocusInside] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [showRemaining, setShowRemaining] = useState(false);
  const [ripple, setRipple] = useState<{
    side: 'left' | 'right';
    total: number;
    key: number;
  } | null>(null);
  const [posterFailed, setPosterFailed] = useState(false);
  const [pipSupported, setPipSupported] = useState(false);
  const [pipActive, setPipActive] = useState(false);
  const [videoNode, setVideoNode] = useState<HTMLVideoElement | null>(null);
  const [airplayTarget, setAirplayTarget] = useState(false);
  const [activity, setActivity] = useState(0);
  const lastActivity = useRef(0);
  const playRef = useRef<HTMLButtonElement | null>(null);
  const compact = useMediaQuery('(max-width: 640px)');
  const keyed = useMediaQuery('(hover: hover) and (pointer: fine)');
  const wide = useMediaQuery('(min-width: 960px) and (pointer: fine)');

  const setVideo = useCallback(
    (el: HTMLVideoElement | null) => {
      videoEl.current = el;
      setVideoNode(el);
      const r = props.videoRef;
      if (typeof r === 'function') r(el);
      else if (r) (r as { current: HTMLVideoElement | null }).current = el;
    },
    [props.videoRef],
  );

  // ---- controls visibility ----
  const bump = useCallback(() => {
    // The Skip button returns on pointer or key activity. Throttled so it never renders on every move.
    const now = Date.now();
    if (now - lastActivity.current > 500) {
      lastActivity.current = now;
      setActivity((a) => a + 1);
    }
    setShown(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      if (playingRef.current) setShown(false);
    }, HIDE_AFTER_MS);
  }, []);

  useEffect(() => {
    if (state.playing) bump();
    else setShown(true);
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [state.playing, bump]);

  const theatreAvailable = Boolean(props.onTheatreToggle) && wide && !compact && !fullscreen;
  const controlsVisible =
    shown || !state.playing || menu !== null || focusInside || state.phase !== 'ready';

  // ---- fullscreen, orientation, pip ----
  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === containerRef.current);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    const el = containerRef.current;
    const v = videoEl.current as FsVideo | null;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        (screen.orientation as { unlock?: () => void } | undefined)?.unlock?.();
      } else if (el?.requestFullscreen) {
        await el.requestFullscreen();
        const orientation = screen.orientation as
          { lock?: (o: string) => Promise<void> } | undefined;
        if (compact) void orientation?.lock?.('landscape').catch(() => undefined);
      } else if (v?.webkitEnterFullscreen) {
        v.webkitEnterFullscreen();
      } else {
        controller?.notify(msg('player.fullscreenUnavailable'), 'error');
      }
    } catch {
      controller?.notify(msg('player.fullscreenUnavailable'), 'error');
    }
  }, [compact, controller]);

  // Picture in picture: the standard API and the iOS webkit one, with state from the events (L4-10).
  useEffect(() => {
    if (!videoNode) return;
    setPipSupported(pipSupportedBy(videoNode, document));
    setPipActive(inPip(videoNode, document));
    return watchPip(videoNode, document, setPipActive);
  }, [videoNode]);

  const togglePip = useCallback(async () => {
    try {
      await pipToggle(videoEl.current, document);
    } catch {
      controller?.notify(msg('player.pipUnavailable'), 'error');
    }
  }, [controller]);

  // AirPlay stays off until the device spike passes (R16): the host turns it on with `airplay`.
  useEffect(() => {
    if (!props.airplay || !videoNode) {
      setAirplayTarget(false);
      return;
    }
    const stopTarget = watchAirplayAvailability(videoNode, setAirplayTarget);
    const stopWireless = watchWireless(videoNode, (w) => controller?.setWireless(w));
    return () => {
      stopTarget();
      stopWireless();
    };
  }, [props.airplay, videoNode, controller]);

  // ---- caption tracks ----
  const tracks = state.captions.tracks;
  const active = state.captions.active;
  useEffect(() => {
    const v = videoEl.current;
    if (!v) return;
    for (let i = 0; i < v.textTracks.length; i++) {
      const t = v.textTracks[i];
      if (t) t.mode = t.id === active ? 'showing' : 'disabled';
    }
  }, [active, tracks]);

  const trackRef = useCallback(
    (id: string) => (el: HTMLTrackElement | null) => {
      if (!el) return;
      const onError = () => controller?.captionFailed(id);
      el.addEventListener('error', onError, { once: true });
    },
    [controller],
  );

  // ---- media session (lock screen controls) ----
  useEffect(() => {
    if (!controller || typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    const ms = navigator.mediaSession;
    try {
      if (typeof MediaMetadata !== 'undefined') {
        ms.metadata = new MediaMetadata({ title, artwork: posterUrl ? [{ src: posterUrl }] : [] });
      }
      ms.setActionHandler('play', () => controller.play());
      ms.setActionHandler('pause', () => controller.pause());
      ms.setActionHandler('seekbackward', () => controller.seekBy(-10));
      ms.setActionHandler('seekforward', () => controller.seekBy(10));
      ms.setActionHandler('nexttrack', next ? () => controller.playNext() : null);
    } catch {
      // Some browsers throw for unsupported actions.
    }
    return () => {
      try {
        for (const a of ['play', 'pause', 'seekbackward', 'seekforward', 'nexttrack'] as const)
          ms.setActionHandler(a, null);
      } catch {
        // ignore
      }
    };
  }, [controller, title, posterUrl, next]);

  // ---- menus ----
  const closeMenu = useCallback(() => {
    setMenu(null);
    openerRef.current?.focus();
  }, []);

  const toggleMenu = (id: MenuId) => (e: { currentTarget: HTMLElement }) => {
    openerRef.current = e.currentTarget;
    setSettingsStart(undefined);
    setMenu((m) => (m === id ? null : id));
  };

  useEffect(() => {
    if (menu === null) return;
    const onDown = (e: Event) => {
      const t = e.target as HTMLElement;
      if (!t.closest?.('.adp-anchor')) setMenu(null);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [menu]);

  // ---- input ----
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!controller) return;
    const target = e.target as HTMLElement;
    if (target.closest('[role="menu"], [role="dialog"]')) return;
    bump();
    controller.noteInput();
    if (state.upNext.countdown !== null) controller.cancelCountdown();
    const onButton = target.closest('button, a');
    if (onButton && (e.key === ' ' || e.key === 'Enter')) return;
    const action = resolveShortcut(
      {
        key: e.key,
        code: e.code,
        shiftKey: e.shiftKey,
        ctrlKey: e.ctrlKey,
        metaKey: e.metaKey,
        altKey: e.altKey,
        target: e.target,
      },
      { hasNext: Boolean(next), hasSkip: Boolean(state.marker), hasTheatre: theatreAvailable },
    );
    if (!action) return;
    e.preventDefault();
    if (action.type === 'toggle-fullscreen') void toggleFullscreen();
    else if (action.type === 'help') setHelpOpen(true);
    else if (action.type === 'theatre') props.onTheatreToggle?.();
    else controller.dispatch(action);
  };

  const onSurfacePointerDown = (e: PointerEvent<HTMLDivElement>) => {
    pointerType.current = e.pointerType;
    controller?.noteInput();
  };

  const onSurfacePointerUp = (e: PointerEvent<HTMLDivElement>) => {
    containerRef.current?.focus({ preventScroll: true });
    if (!controller || e.pointerType === 'mouse') return;
    const rect = e.currentTarget.getBoundingClientRect();
    const result = tapper.current.tap(e.clientX - rect.left, rect.width, performance.now());
    if (result.kind === 'tap') {
      if (controlsVisible && state.playing) setShown(false);
      else bump();
    } else if (result.kind === 'seek') {
      controller.seekBy(result.seconds);
      bump();
      if (rippleTimer.current) clearTimeout(rippleTimer.current);
      setRipple({ side: result.side, total: result.total, key: Date.now() });
      rippleTimer.current = setTimeout(() => setRipple(null), 700);
    } else {
      controller.toggle();
      bump();
    }
  };

  const onSurfaceClick = () => {
    if (menu) {
      setMenu(null);
      return;
    }
    if (pointerType.current === 'mouse') controller?.toggle();
  };

  const onFocus = () => {
    let visible = false;
    try {
      visible = Boolean(document.activeElement?.matches(':focus-visible'));
    } catch {
      visible = false;
    }
    if (visible) {
      setFocusInside(true);
      setShown(true);
    }
  };

  const multiLanguage = tracks.length > 1;
  const time = useMemo(() => {
    const total = formatClock(state.duration);
    return showRemaining
      ? `-${formatClock(Math.max(0, state.duration - state.currentTime))} / ${total}`
      : `${formatClock(state.currentTime)} / ${total}`;
  }, [showRemaining, state.currentTime, state.duration]);

  const dataSaverNote = state.quality.dataSaver ? (
    <p className="adp-menu__note">
      {`${msg('player.dataSaver.note')} `}
      {links.playbackSettings ? (
        <a href={links.playbackSettings}>{msg('player.dataSaver.change')}</a>
      ) : (
        msg('player.dataSaver.change')
      )}
    </p>
  ) : null;

  const chapterList = useMemo(
    () => normalizeChapters(props.chapters, state.duration),
    [props.chapters, state.duration],
  );
  const qualityMenu = state.quality.menu;
  const showQuality = qualityMenu.visible;

  return (
    <div
      ref={containerRef}
      className="adp"
      role="region"
      aria-label={msg('player.label', { title })}
      tabIndex={-1}
      style={captionStyleVars(capStyle) as CSSProperties}
      data-compact={compact || undefined}
      data-fullscreen={fullscreen || undefined}
      data-controls={controlsVisible ? 'visible' : 'hidden'}
      data-skip={state.marker ? 'true' : undefined}
      data-phase={state.phase}
      onKeyDown={onKeyDown}
      onPointerMove={(e) => {
        if (e.pointerType !== 'mouse') return;
        controller?.noteInput();
        bump();
      }}
      onFocus={onFocus}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocusInside(false);
        else if (!(e.relatedTarget as HTMLElement | null)?.closest?.('.adp-controls'))
          setFocusInside(false);
      }}
    >
      <video ref={setVideo} className="adp-video" preload="metadata" playsInline aria-hidden="true">
        {tracks.map((t) => (
          <track
            key={t.id}
            ref={trackRef(t.id)}
            id={t.id}
            kind="captions"
            srcLang={t.language}
            label={t.label}
            src={t.src}
          />
        ))}
      </video>

      {posterUrl && !posterFailed ? (
        <img
          className="adp-poster"
          src={posterUrl}
          alt=""
          aria-hidden="true"
          data-state={state.phase === 'loading' ? 'visible' : 'hidden'}
          onError={() => setPosterFailed(true)}
        />
      ) : null}

      <div
        className="adp-surface"
        aria-hidden="true"
        onPointerDown={onSurfacePointerDown}
        onPointerUp={onSurfacePointerUp}
        onClick={onSurfaceClick}
        onDoubleClick={() => pointerType.current === 'mouse' && void toggleFullscreen()}
      />

      <SkipButton
        marker={state.marker}
        showKeyHint={keyed}
        activity={activity}
        onSkip={() => {
          controller?.skip();
          playRef.current?.focus();
        }}
      />

      {ripple ? (
        <div className="adp-ripple" data-side={ripple.side} key={ripple.key} aria-hidden="true">
          {`${ripple.total > 0 ? '+' : '-'}${Math.abs(ripple.total)}`}
        </div>
      ) : null}

      {state.buffering && !state.error ? (
        <Spinner label={state.slowNotice ? msg('player.slowConnection') : undefined} />
      ) : null}

      {!state.playing && state.phase === 'ready' && !state.buffering ? (
        <button
          type="button"
          className="adp-bigplay"
          aria-hidden="true"
          tabIndex={-1}
          onClick={() => controller?.play()}
        >
          <PlayIcon size={32} />
        </button>
      ) : null}

      {state.error ? (
        <ErrorOverlay
          kind={state.error}
          position={state.currentTime}
          reference={reference}
          retries={state.retries}
          links={links}
          onRetry={() => controller?.retry()}
          onSignIn={props.onSignIn}
        />
      ) : null}

      {state.backOnline && !state.error ? (
        <div className="adp-banner" role="status">
          <span>{msg('player.backOnline')}</span>
          <button
            type="button"
            className="adp-btn adp-btn--primary"
            onClick={() => controller?.play()}
          >
            {msg('player.action.resume')}
          </button>
        </div>
      ) : null}

      {state.phase === 'ended' && !state.error ? (
        <EndScreen
          data={props.end ?? {}}
          next={next}
          countdown={state.upNext.countdown}
          countdownTotal={clampCountdown(props.countdownSeconds)}
          cancelled={state.upNext.cancelled}
          stillWatching={state.upNext.stillWatching}
          onKeepWatching={() => controller?.keepWatching()}
          onStopAutoplay={() => controller?.stopAutoplay()}
          autoplayNext={controller ? state.autoplayNext : (props.autoplayNext ?? false)}
          onPlayNext={() => controller?.playNext()}
          onCancel={() => controller?.cancelCountdown()}
          onReplay={() => controller?.replay()}
        />
      ) : null}

      {state.upNext.tile && next && state.phase === 'ready' ? (
        <UpNextTile
          item={next}
          onPlay={() => controller?.playNext()}
          onDismiss={() => controller?.dismissUpNextTile()}
        />
      ) : null}

      {pipActive || state.wireless ? (
        <div className="adp-away" role="status">
          <p className="adp-away__text">
            {state.wireless ? msg('player.airplay.active') : msg('player.pip.active')}
          </p>
          {pipActive ? (
            <button
              type="button"
              className="adp-btn adp-btn--primary"
              onClick={() => void togglePip()}
            >
              {msg('player.pip.bringBack')}
            </button>
          ) : null}
        </div>
      ) : null}

      {state.hint && !state.error ? (
        <HintBar
          kind={state.hint.kind}
          onAction={() => {
            if (state.hint?.kind === 'data-saver') {
              controller?.enableDataSaver();
              return;
            }
            controller?.dismissHint();
            openerRef.current = containerRef.current;
            setSettingsStart('quality');
            setMenu('settings');
          }}
          onDismiss={() => controller?.dismissHint()}
        />
      ) : null}

      {state.toast ? (
        <Toast
          toast={state.toast}
          onDismiss={() => controller?.dismissToast()}
          onAction={() => controller?.startOver()}
        />
      ) : null}

      {fullscreen || compact ? (
        <div className="adp-top" data-visible={controlsVisible || undefined}>
          <span className="adp-top__title">{title}</span>
        </div>
      ) : null}

      <div
        className="adp-controls"
        data-visible={controlsVisible || undefined}
        hidden={state.phase === 'ended' && !state.error ? true : undefined}
      >
        <button
          type="button"
          ref={playRef}
          className="adp-ctl adp-ctl--primary"
          aria-label={state.playing ? msg('player.pause') : msg('player.play')}
          onClick={() => controller?.toggle()}
        >
          {state.playing ? <PauseIcon size={32} /> : <PlayIcon size={32} />}
        </button>
        <SeekBar
          currentTime={state.currentTime}
          duration={state.duration}
          bufferedEnd={state.bufferedEnd}
          onSeek={(t) => controller?.seekTo(t)}
          spriteUrl={state.quality.dataSaver ? null : props.spriteUrl}
          chapters={chapterList}
        />
        <button
          type="button"
          className="adp-ctl"
          aria-label={msg('player.seek.back10')}
          onClick={() => controller?.seekBy(-10)}
        >
          <Back10Icon />
        </button>
        <button
          type="button"
          className="adp-ctl"
          aria-label={msg('player.seek.forward10')}
          onClick={() => controller?.seekBy(10)}
        >
          <Forward10Icon />
        </button>
        {state.hasAudio ? (
          <div className="adp-volume">
            <button
              type="button"
              className="adp-ctl"
              aria-label={state.muted ? msg('player.unmute') : msg('player.mute')}
              aria-pressed={state.muted}
              onClick={() => controller?.toggleMute()}
            >
              {state.muted || state.volume === 0 ? <MutedIcon /> : <VolumeIcon />}
            </button>
            {!compact ? (
              <input
                className="adp-volume__slider"
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={state.muted ? 0 : state.volume}
                aria-label={msg('player.volume')}
                aria-valuetext={`${Math.round((state.muted ? 0 : state.volume) * 100)} percent`}
                onChange={(e) => controller?.setVolume(Number(e.target.value))}
              />
            ) : null}
          </div>
        ) : null}
        <button
          type="button"
          className="adp-time"
          aria-label={
            showRemaining ? msg('player.time.showElapsed') : msg('player.time.showRemaining')
          }
          onClick={() => setShowRemaining((v) => !v)}
        >
          {time}
        </button>
        {!compact && state.chapter ? (
          <span className="adp-chapter">{state.chapter.title}</span>
        ) : null}
        <span className="adp-spacer" />

        {!compact && chapterList.length > 0 ? (
          <div className="adp-anchor">
            <button
              type="button"
              className="adp-ctl"
              aria-haspopup="menu"
              aria-expanded={menu === 'chapters'}
              aria-label={msg('player.chapters')}
              onClick={toggleMenu('chapters')}
            >
              <ChaptersIcon />
            </button>
            {menu === 'chapters' ? (
              <MenuShell id="adp-menu-chapters" label={msg('player.chapters')} onClose={closeMenu}>
                <ChapterRows
                  chapters={chapterList}
                  current={state.chapter?.index ?? null}
                  onSelect={(start) => {
                    controller?.seekTo(start);
                    closeMenu();
                  }}
                />
              </MenuShell>
            ) : null}
          </div>
        ) : null}

        {state.captions.available ? (
          <div className="adp-anchor">
            {multiLanguage ? (
              <button
                type="button"
                className="adp-ctl"
                aria-haspopup="menu"
                aria-expanded={menu === 'captions'}
                aria-label={
                  active ? msg('player.captionsButtonOn') : msg('player.captionsButtonOff')
                }
                data-on={active ? true : undefined}
                onClick={toggleMenu('captions')}
              >
                <CaptionsIcon />
              </button>
            ) : (
              <button
                type="button"
                className="adp-ctl"
                aria-label={msg('player.captions')}
                aria-pressed={active !== null}
                data-on={active ? true : undefined}
                onClick={() => controller?.toggleCaptions()}
              >
                <CaptionsIcon />
              </button>
            )}
            {menu === 'captions' ? (
              <MenuShell
                id="adp-menu-captions"
                label={msg('player.captions')}
                onClose={closeMenu}
                footer={
                  props.onCaptionStyleChange ? (
                    <button
                      type="button"
                      role="menuitem"
                      className="adp-menu__row"
                      onClick={openCaptionStyle}
                    >
                      {msg('player.captionStyle.link')}
                    </button>
                  ) : null
                }
              >
                <CaptionRows
                  tracks={tracks}
                  active={active}
                  onSelect={(id) => {
                    controller?.selectCaption(id);
                    closeMenu();
                  }}
                />
              </MenuShell>
            ) : null}
          </div>
        ) : null}

        <div className="adp-anchor">
          <button
            type="button"
            className="adp-ctl"
            aria-haspopup="menu"
            aria-expanded={menu === 'settings'}
            aria-label={msg('player.settings')}
            onClick={toggleMenu('settings')}
          >
            <SettingsIcon />
          </button>
          {menu === 'settings' ? (
            <SettingsMenu
              initialView={settingsStart}
              rate={state.rate}
              onRate={(r) => controller?.setRate(r)}
              quality={showQuality ? qualityMenu : null}
              onQuality={(sel) => controller?.selectQuality(sel)}
              dataSaverNote={dataSaverNote}
              autoplayNext={state.autoplayNext}
              autoplayLocked={props.lockAutoplay}
              onAutoplay={(on) => controller?.setAutoplayNext(on)}
              onCaptionStyle={
                props.onCaptionStyleChange && state.captions.available
                  ? openCaptionStyle
                  : undefined
              }
              onShortcuts={
                compact
                  ? undefined
                  : () => {
                      setMenu(null);
                      setHelpOpen(true);
                    }
              }
              chapters={
                compact && chapterList.length > 0 ? (
                  <>
                    <p className="adp-menu__section">{msg('player.chapters')}</p>
                    <ChapterRows
                      chapters={chapterList}
                      current={state.chapter?.index ?? null}
                      onSelect={(start) => {
                        controller?.seekTo(start);
                        closeMenu();
                      }}
                    />
                  </>
                ) : null
              }
              onClose={closeMenu}
            />
          ) : null}
          {menu === 'captionStyle' ? (
            <CaptionAppearance style={capStyle} onChange={changeCaptionStyle} onClose={closeMenu} />
          ) : null}
        </div>

        {props.airplay && airplayTarget ? (
          <button
            type="button"
            className="adp-ctl"
            aria-label={msg('player.airplay.button')}
            onClick={() => controller?.openAirplay()}
          >
            <AirplayIcon />
          </button>
        ) : null}

        {pipSupported ? (
          <button
            type="button"
            className="adp-ctl"
            aria-label={msg('player.pip')}
            aria-pressed={pipActive}
            onClick={() => void togglePip()}
          >
            <PipIcon />
          </button>
        ) : null}

        {theatreAvailable ? (
          <button
            type="button"
            className="adp-ctl"
            aria-label={props.theatre ? msg('player.theatre.exit') : msg('player.theatre.enter')}
            aria-pressed={props.theatre ?? false}
            onClick={() => props.onTheatreToggle?.()}
          >
            <TheatreIcon />
          </button>
        ) : null}

        <button
          type="button"
          className="adp-ctl"
          aria-label={fullscreen ? msg('player.fullscreen.exit') : msg('player.fullscreen.enter')}
          onClick={() => void toggleFullscreen()}
        >
          {fullscreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
        </button>
      </div>

      {helpOpen ? <ShortcutsDialog onClose={() => setHelpOpen(false)} /> : null}

      <div className="adp-sr" role="status" aria-live="polite">
        {state.announce}
      </div>
    </div>
  );
}
