import { msg } from '@ad/shared/messages';
import { useEffect, useRef } from 'react';
import { formatClock } from '../format';
import type { PlayerErrorKind, PlayerHint, PlayerToast } from '../types';
import { CloseIcon, PlayIcon } from './icons';

export interface OverlayLinks {
  signIn?: string;
  browse?: string;
  help?: string;
}

interface ErrorOverlayProps {
  kind: PlayerErrorKind;
  position: number;
  reference: string;
  /** Retries in a row. The reference line shows on connection lost from the third. */
  retries?: number;
  links: OverlayLinks;
  onRetry(): void;
  onSignIn?: (() => void) | undefined;
}

const COPY: Record<PlayerErrorKind, { title: string; body: (p: number, ref: string) => string }> = {
  'connection-lost': {
    title: msg('player.error.connectionLost.title'),
    body: (p) => msg('player.error.connectionLost.body', { time: formatClock(p) }),
  },
  offline: {
    title: msg('player.error.offline.title'),
    body: () => msg('player.error.offline.body'),
  },
  'session-expired': {
    title: msg('player.error.sessionExpired.title'),
    body: () => msg('player.error.sessionExpired.body'),
  },
  removed: {
    title: msg('player.error.removed.title'),
    body: () => msg('player.error.removed.body'),
  },
  'cannot-play': {
    title: msg('player.error.cannotPlay.title'),
    body: () => msg('player.error.cannotPlay.body'),
  },
  'unsupported-browser': {
    title: msg('player.error.unsupportedBrowser.title'),
    body: () => msg('player.error.unsupportedBrowser.body'),
  },
};

export function ErrorOverlay({
  kind,
  position,
  reference,
  retries = 0,
  links,
  onRetry,
  onSignIn,
}: ErrorOverlayProps) {
  const copy = COPY[kind];
  const actions = useRef<HTMLDivElement>(null);
  // One action per error (R39), and it takes focus so a keyboard or screen reader viewer lands on it.
  useEffect(() => {
    actions.current?.querySelector<HTMLElement>('button, a[href]')?.focus();
  }, [kind]);
  const showReference = kind === 'cannot-play' || (kind === 'connection-lost' && retries >= 3);
  return (
    <div className="adp-overlay adp-overlay--error" role="alert" data-kind={kind}>
      <div className="adp-overlay__card">
        <h2 className="adp-overlay__title">{copy.title}</h2>
        <p className="adp-overlay__body">{copy.body(position, reference)}</p>
        <div className="adp-overlay__actions" ref={actions}>
          {kind === 'connection-lost' ? (
            <button type="button" className="adp-btn adp-btn--primary" onClick={onRetry}>
              {msg('player.action.retry')}
            </button>
          ) : null}
          {kind === 'offline' || kind === 'cannot-play' ? (
            <button type="button" className="adp-btn adp-btn--primary" onClick={onRetry}>
              {msg('player.action.tryAgain')}
            </button>
          ) : null}
          {kind === 'session-expired' ? (
            links.signIn ? (
              <a className="adp-btn adp-btn--primary" href={links.signIn}>
                {msg('player.action.signIn')}
              </a>
            ) : (
              <button type="button" className="adp-btn adp-btn--primary" onClick={onSignIn}>
                {msg('player.action.signIn')}
              </button>
            )
          ) : null}
          {kind === 'removed' && links.browse ? (
            <a className="adp-btn adp-btn--primary" href={links.browse}>
              {msg('player.action.browse')}
            </a>
          ) : null}
          {kind === 'unsupported-browser' && links.help ? (
            <a className="adp-btn adp-btn--primary" href={links.help}>
              {msg('player.action.help')}
            </a>
          ) : null}
        </div>
        {showReference ? (
          <p className="adp-overlay__ref">{msg('player.error.reference', { reference })}</p>
        ) : null}
      </div>
    </div>
  );
}

/** A slow connection hint: one sentence, one action, and a way to dismiss it (L4-11). */
export function HintBar({
  kind,
  onAction,
  onDismiss,
}: {
  kind: PlayerHint['kind'];
  onAction(): void;
  onDismiss(): void;
}) {
  const data = kind === 'data-saver';
  return (
    <div className="adp-hint" role="status">
      <span>{data ? msg('player.hint.dataSaver') : msg('player.hint.lockedQuality')}</span>
      <button type="button" className="adp-toast__action" onClick={onAction}>
        {data ? msg('player.hint.dataSaver.action') : msg('player.hint.lockedQuality.action')}
      </button>
      <button
        type="button"
        className="adp-toast__close"
        aria-label={msg('player.hint.dismiss')}
        onClick={onDismiss}
      >
        <CloseIcon size={16} />
      </button>
    </div>
  );
}

export function Spinner({ label }: { label?: string | undefined }) {
  return (
    <div className="adp-spinner-wrap" aria-hidden="true">
      <div className="adp-spinner" />
      {label ? <p className="adp-spinner__label">{label}</p> : null}
    </div>
  );
}

export function Toast({
  toast,
  onDismiss,
  onAction,
}: {
  toast: PlayerToast;
  onDismiss(): void;
  onAction(): void;
}) {
  return (
    <div
      className="adp-toast"
      data-kind={toast.kind}
      role={toast.kind === 'error' ? 'alert' : 'status'}
    >
      <span>{toast.message}</span>
      {toast.action === 'start-over' ? (
        <button type="button" className="adp-toast__action" onClick={onAction}>
          {msg('player.action.startOver')}
        </button>
      ) : null}
      <button
        type="button"
        className="adp-toast__close"
        aria-label={msg('player.action.dismiss')}
        onClick={onDismiss}
      >
        <CloseIcon size={16} />
      </button>
    </div>
  );
}

export interface NextCardItem {
  id: string;
  title: string;
  posterUrl?: string | undefined;
}

export function UpNextTile({
  item,
  onPlay,
  onDismiss,
}: {
  item: NextCardItem;
  onPlay(): void;
  onDismiss(): void;
}) {
  return (
    <div className="adp-tile">
      <button type="button" className="adp-tile__main" onClick={onPlay}>
        <PlayIcon size={16} />
        <span>
          <span className="adp-tile__kicker">{msg('player.upNext.kicker')}</span>
          <span className="adp-tile__title">{item.title}</span>
        </span>
      </button>
      <button
        type="button"
        className="adp-tile__close"
        aria-label={msg('player.upNext.dismiss')}
        onClick={onDismiss}
      >
        <CloseIcon size={16} />
      </button>
    </div>
  );
}
