'use client';

import { useCallback, useEffect, useId, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { IconButton } from '@ad/ui';
import { useT } from '../../lib/i18n/provider';
import { ShareIcon } from './share-icons';
import {
  sheetTargets,
  targetHref,
  type LinkChannel,
  type ShareTargetId,
} from './share-targets';
import './share-sheet.css';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), [tabindex]:not([tabindex="-1"])';
/** Web targets need a connection to finish. Messages, Copy link and More do not. */
const NEEDS_NETWORK: readonly ShareTargetId[] = ['whatsapp', 'facebook', 'x', 'telegram', 'email'];
const POPOVER_WIDTH = 380;
const EDGE = 16;

export interface ShareSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  text: string;
  /** The clean canonical address. Never the address bar. */
  url: string;
  kind: 'video' | 'series';
  /** Channels the admin enabled, in order. Copy link and More are added here. */
  channels: readonly ShareTargetId[];
  thumbnail?: string;
  /** The button the popover hangs from. Without it the popover is centred. */
  anchor?: HTMLElement | null;
  /** One anonymous count per chosen place (slice 4). */
  onShare?: (target: ShareTargetId) => void;
}

type Mode = 'sheet' | 'popover' | 'dialog';

function useMode(): Mode {
  const [mode, setMode] = useState<Mode>('sheet');
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const wide = window.matchMedia('(min-width: 600px)');
    const update = () =>
      setMode(!wide.matches ? 'sheet' : window.innerHeight < 560 ? 'dialog' : 'popover');
    update();
    wide.addEventListener('change', update);
    window.addEventListener('resize', update);
    return () => {
      wide.removeEventListener('change', update);
      window.removeEventListener('resize', update);
    };
  }, []);
  return mode;
}

function useOnline(): boolean {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine !== false);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);
  return online;
}

async function copyText(text: string, field: HTMLInputElement | null): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the selection copy
  }
  try {
    field?.select();
    field?.setSelectionRange(0, text.length);
    if (typeof document.execCommand === 'function' && document.execCommand('copy')) return true;
  } catch {
    // nothing can copy here
  }
  return false;
}

/**
 * The Share sheet (L15a, D-391). Under 600 px a bottom sheet with a handle that can be swiped down, from 600 px a
 * popover hung from the Share button, or a centred dialog on a short window. Plain links and the Web Share API only.
 */
export function ShareSheet({
  open,
  onClose,
  title,
  text,
  url,
  kind,
  channels,
  thumbnail,
  anchor,
  onShare,
}: ShareSheetProps) {
  const t = useT();
  const mode = useMode();
  const online = useOnline();
  const headingId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<HTMLInputElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const [nativeShare, setNativeShare] = useState(false);
  const [status, setStatus] = useState<{ text: string; tone: 'ok' | 'error' | 'muted' } | null>(null);
  const [copied, setCopied] = useState(false);
  const [pos, setPos] = useState<CSSProperties | undefined>(undefined);
  const drag = useRef<{ startY: number; startT: number; dy: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    setNativeShare(typeof navigator.share === 'function');
    setStatus(null);
    setCopied(false);
  }, [open]);

  // Focus in, lock the page behind it, give focus back.
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    if (mode !== 'popover') document.body.style.overflow = 'hidden';
    const root = dialogRef.current?.closest('.share-root');
    const inerted: HTMLElement[] = [];
    for (const child of Array.from(document.body.children)) {
      if (child instanceof HTMLElement && child !== root && !child.hasAttribute('inert')) {
        child.setAttribute('inert', '');
        inerted.push(child);
      }
    }
    dialogRef.current?.querySelector<HTMLElement>('[data-testid="share-target"]')?.focus();
    return () => {
      document.body.style.overflow = overflow;
      for (const child of inerted) child.removeAttribute('inert');
      previous?.focus?.();
    };
  }, [open, mode]);

  // Hang the popover from its button, flipped to the right edge near the right side of the window.
  useEffect(() => {
    if (!open || mode !== 'popover' || !anchor) {
      setPos(undefined);
      return;
    }
    const place = () => {
      const rect = anchor.getBoundingClientRect();
      const width = Math.min(POPOVER_WIDTH, window.innerWidth - EDGE * 2);
      const left = Math.max(
        EDGE,
        Math.min(rect.left, window.innerWidth - width - EDGE),
      );
      const flip = rect.left + width > window.innerWidth - EDGE;
      setPos({
        position: 'fixed',
        top: rect.bottom + 8,
        left: flip ? Math.max(EDGE, rect.right - width) : left,
        width,
        maxHeight: window.innerHeight - rect.bottom - 8 - EDGE,
        transform: 'none',
      });
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [open, mode, anchor]);

  const close = useCallback(() => onCloseRef.current(), []);

  if (!open || typeof document === 'undefined') return null;

  const targets = sheetTargets(channels, { nativeShare });
  const nameOf = (id: ShareTargetId): string => {
    switch (id) {
      case 'copy':
        return t('share.copy');
      case 'whatsapp':
        return t('share.target.whatsapp');
      case 'facebook':
        return t('share.target.facebook');
      case 'x':
        return t('share.target.x');
      case 'telegram':
        return t('share.target.telegram');
      case 'email':
        return t('share.target.email');
      case 'sms':
        return t('share.target.sms');
      case 'more':
        return t('share.target.more');
    }
  };

  async function onCopy() {
    const ok = await copyText(url, fieldRef.current);
    onShare?.('copy');
    if (ok) {
      setCopied(true);
      setStatus({ text: t('share.copied'), tone: 'ok' });
    } else {
      setCopied(false);
      setStatus({ text: t('share.copyFailed'), tone: 'error' });
      fieldRef.current?.focus();
      fieldRef.current?.select();
    }
  }

  async function onMore() {
    try {
      await navigator.share({ title, text, url });
      onShare?.('more');
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setStatus({ text: t('share.nativeFailed'), tone: 'error' });
    }
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.stopPropagation();
      close();
      return;
    }
    if (event.key !== 'Tab') return;
    const nodes = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    if (!first || !last) return;
    const active = document.activeElement;
    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function onPointerDown(event: React.PointerEvent) {
    if (mode !== 'sheet') return;
    drag.current = { startY: event.clientY, startT: Date.now(), dy: 0 };
    (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
  }
  function onPointerMove(event: React.PointerEvent) {
    const d = drag.current;
    if (!d) return;
    d.dy = Math.max(0, event.clientY - d.startY);
    if (dialogRef.current) dialogRef.current.style.transform = `translateY(${d.dy}px)`;
  }
  function onPointerUp() {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    const height = dialogRef.current?.getBoundingClientRect().height ?? 0;
    const flick = d.dy / Math.max(1, Date.now() - d.startT) > 0.6 && d.dy > 40;
    if (d.dy > Math.max(80, height * 0.25) || flick) {
      close();
      return;
    }
    if (dialogRef.current) dialogRef.current.style.transform = '';
  }

  const heading = kind === 'series' ? t('share.title.series') : t('share.title.video');

  return createPortal(
    <div className="share-root" onKeyDown={onKeyDown} data-mode={mode}>
      <div className="share-scrim" data-testid="share-scrim" onClick={close} />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        className="share-sheet"
        data-mode={mode}
        style={pos}
      >
        <div
          className="share-sheet__top"
          data-testid="share-grab"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <span className="share-sheet__handle" aria-hidden="true" />
          <header className="share-sheet__header">
            <span
              className="share-sheet__thumb"
              style={thumbnail ? { backgroundImage: `url("${thumbnail}")` } : undefined}
              aria-hidden="true"
            />
            <div className="share-sheet__text">
              <h2 id={headingId} className="share-sheet__kind">
                {heading}
              </h2>
              <p className="share-sheet__title">{title}</p>
            </div>
            <IconButton label={t('share.close')} icon="close" variant="surface" onClick={close} />
          </header>
        </div>
        <div className="share-sheet__body">
          <ul className="share-grid">
            {targets.map((id) => {
              const label = nameOf(id);
              const icon = (
                <span className="share-target__icon">
                  <ShareIcon id={id} />
                </span>
              );
              const labelEl = <span className="share-target__label">{label}</span>;
              let control: React.ReactNode;
              if (id === 'copy') {
                control = (
                  <button type="button" className="share-target" data-testid="share-target" onClick={() => void onCopy()}>
                    {icon}
                    {labelEl}
                  </button>
                );
              } else if (id === 'more') {
                control = (
                  <button type="button" className="share-target" data-testid="share-target" onClick={() => void onMore()}>
                    {icon}
                    {labelEl}
                  </button>
                );
              } else if (!online && NEEDS_NETWORK.includes(id)) {
                control = (
                  <button
                    type="button"
                    className="share-target share-target--off"
                    data-testid="share-target"
                    aria-disabled="true"
                    onClick={() => setStatus({ text: t('share.offline', { name: label }), tone: 'muted' })}
                  >
                    {icon}
                    {labelEl}
                  </button>
                );
              } else {
                const newTab = id !== 'email' && id !== 'sms';
                control = (
                  <a
                    className="share-target"
                    data-testid="share-target"
                    href={targetHref(id as LinkChannel, { title, text, url })}
                    {...(newTab ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                    onClick={() => {
                      onShare?.(id);
                      close();
                    }}
                  >
                    {icon}
                    {labelEl}
                    {newTab ? <span className="share-sr">{t('share.newTab')}</span> : null}
                  </a>
                );
              }
              return <li key={id}>{control}</li>;
            })}
          </ul>
          <div className="share-link">
            <input
              ref={fieldRef}
              className="share-link__field"
              readOnly
              aria-label={t('share.linkLabel')}
              value={url}
              onFocus={(event) => event.currentTarget.select()}
            />
            <button
              type="button"
              className="share-link__copy"
              data-copied={copied ? 'true' : 'false'}
              onClick={() => void onCopy()}
            >
              {copied ? t('share.copiedButton') : t('share.copyButton')}
            </button>
          </div>
          <p role="status" className="share-status" data-tone={status?.tone ?? 'ok'}>
            {status?.text ?? ''}
          </p>
        </div>
      </div>
    </div>,
    document.body,
  );
}
