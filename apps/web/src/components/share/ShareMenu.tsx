'use client';

import { useEffect, useRef, useState } from 'react';
import { msg } from '@ad/shared/messages';
import { Button, useToast } from '@ad/ui';
import { CHANNEL_TAGS, shareHref, withChannelTag, type ShareChannelId } from './share-links';
import './share.css';

const NAMES: Record<ShareChannelId, string> = {
  whatsapp: 'WhatsApp',
  facebook: 'Facebook',
  x: 'X',
  email: 'Email',
};

export interface ShareMenuProps {
  title: string;
  text: string;
  /** Channels the admin enabled, in menu order. Copy link is always there. */
  channels: ShareChannelId[];
  kind: 'video' | 'series';
}

/**
 * Share button (M45-S06). Phones get the system share sheet. Elsewhere a small dialog lists Copy link first,
 * then the enabled channels (WhatsApp first). Escape closes it and focus returns to the button.
 */
export function ShareMenu({ title, text, channels, kind }: ShareMenuProps) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [manual, setManual] = useState<string | null>(null);
  const trigger = useRef<HTMLSpanElement>(null);
  const copyButton = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  function close() {
    setOpen(false);
    setManual(null);
    trigger.current?.querySelector('button')?.focus();
  }

  useEffect(() => {
    if (open) copyButton.current?.focus();
  }, [open]);

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'Escape') {
      event.stopPropagation();
      close();
      return;
    }
    if (event.key !== 'Tab' || !panel.current) return;
    const items = [...panel.current.querySelectorAll<HTMLElement>('button, a[href], input')].filter(
      (el) => !el.hasAttribute('disabled'),
    );
    const first = items[0];
    const last = items[items.length - 1];
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  async function onShare() {
    const url = window.location.href;
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title, text, url: withChannelTag(url, CHANNEL_TAGS.native) });
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setManual(url);
        setOpen(true);
      }
      return;
    }
    setOpen((value) => !value);
  }

  async function onCopy() {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(withChannelTag(url, CHANNEL_TAGS.copy));
      toast.show({ message: msg('share.copied'), variant: 'success' });
      close();
    } catch {
      setManual(url);
    }
  }

  const url = typeof window === 'undefined' ? '' : window.location.href;
  const heading = kind === 'series' ? msg('share.title.series') : msg('share.title.video');

  return (
    <span className="share" ref={trigger}>
      <Button
        variant="secondary"
        icon="share"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => void onShare()}
      >
        {msg('share.button')}
      </Button>
      {open ? (
        <>
          <div className="share__scrim" onClick={close} aria-hidden="true" />
          <div
            ref={panel}
            className="share__panel"
            role="dialog"
            aria-label={heading}
            onKeyDown={onKeyDown}
          >
            <p className="share__title">{heading}</p>
            <button
              ref={copyButton}
              type="button"
              className="share__item"
              onClick={() => void onCopy()}
            >
              {msg('share.copy')}
            </button>
            {channels.map((channel) => (
              <a
                key={channel}
                className="share__item"
                href={shareHref(channel, { title, text, url })}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setOpen(false)}
              >
                {NAMES[channel]}
                <span className="share__sr">{msg('share.newTab')}</span>
              </a>
            ))}
            {manual ? (
              <input
                className="share__field"
                readOnly
                aria-label={msg('share.linkLabel')}
                value={manual}
                onFocus={(event) => event.currentTarget.select()}
              />
            ) : null}
            <button type="button" className="share__item share__close" onClick={close}>
              {msg('share.close')}
            </button>
          </div>
        </>
      ) : null}
    </span>
  );
}
