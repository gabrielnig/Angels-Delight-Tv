import { formatClock } from '../format';
import type { PlayerErrorKind, PlayerToast } from '../types';
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
  links: OverlayLinks;
  onRetry(): void;
  onSignIn?: (() => void) | undefined;
}

const COPY: Record<PlayerErrorKind, { title: string; body: (p: number, ref: string) => string }> = {
  'connection-lost': {
    title: 'Connection lost',
    body: (p) => `We will keep your place at ${formatClock(p)}.`,
  },
  offline: {
    title: 'You are offline',
    body: () => 'Connect to the internet to keep watching. Your place is saved.',
  },
  'session-expired': {
    title: 'Sign in again to keep watching',
    body: () => 'For your safety we signed you out. Your place is saved.',
  },
  removed: {
    title: 'This video is no longer available',
    body: () => 'It may have been taken down. Try something else.',
  },
  'cannot-play': {
    title: 'This video cannot play on this device',
    body: (_p, ref) => `Try another browser or device. Reference ${ref}.`,
  },
  'unsupported-browser': {
    title: 'This browser cannot play this video',
    body: () => 'Use a recent version of Chrome, Edge, Firefox or Safari.',
  },
};

export function ErrorOverlay({
  kind,
  position,
  reference,
  links,
  onRetry,
  onSignIn,
}: ErrorOverlayProps) {
  const copy = COPY[kind];
  return (
    <div className="adp-overlay adp-overlay--error" role="alert" data-kind={kind}>
      <div className="adp-overlay__card">
        <h2 className="adp-overlay__title">{copy.title}</h2>
        <p className="adp-overlay__body">{copy.body(position, reference)}</p>
        <div className="adp-overlay__actions">
          {kind === 'connection-lost' ? (
            <button type="button" className="adp-btn adp-btn--primary" onClick={onRetry}>
              Retry
            </button>
          ) : null}
          {kind === 'offline' || kind === 'cannot-play' ? (
            <button type="button" className="adp-btn adp-btn--primary" onClick={onRetry}>
              Try again
            </button>
          ) : null}
          {kind === 'session-expired' ? (
            links.signIn ? (
              <a className="adp-btn adp-btn--primary" href={links.signIn}>
                Sign in
              </a>
            ) : (
              <button type="button" className="adp-btn adp-btn--primary" onClick={onSignIn}>
                Sign in
              </button>
            )
          ) : null}
          {kind === 'removed' && links.browse ? (
            <a className="adp-btn adp-btn--primary" href={links.browse}>
              Browse videos
            </a>
          ) : null}
          {kind === 'cannot-play' && links.help ? (
            <a className="adp-btn adp-btn--ghost" href={links.help}>
              Report a problem
            </a>
          ) : null}
        </div>
      </div>
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
          Start over
        </button>
      ) : null}
      <button type="button" className="adp-toast__close" aria-label="Dismiss" onClick={onDismiss}>
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
          <span className="adp-tile__kicker">Next</span>
          <span className="adp-tile__title">{item.title}</span>
        </span>
      </button>
      <button
        type="button"
        className="adp-tile__close"
        aria-label="Dismiss next video"
        onClick={onDismiss}
      >
        <CloseIcon size={16} />
      </button>
    </div>
  );
}
