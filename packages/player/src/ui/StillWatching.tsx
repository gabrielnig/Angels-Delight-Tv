'use client';

import { usePlayerT } from '../t';
import { useEffect, useRef, type KeyboardEvent } from 'react';

/**
 * Shown instead of the countdown after three autoplays with no input, so an unattended device stops spending
 * data (L4-08, R15). Focus starts on Keep watching and stays inside. Stop leaves for the title page when there
 * is one, otherwise it stays here.
 */
export function StillWatching({
  title,
  stopHref,
  onKeep,
  onStop,
}: {
  title: string;
  stopHref?: string | undefined;
  onKeep(): void;
  onStop(): void;
}) {
  const msg = usePlayerT();
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('button')?.focus();
  }, []);

  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    e.stopPropagation();
    if (e.key === 'Escape') {
      onStop();
      return;
    }
    if (e.key !== 'Tab') return;
    const items = ref.current?.querySelectorAll<HTMLElement>('button, a[href]');
    if (!items || items.length === 0) return;
    const first = items[0] as HTMLElement;
    const last = items[items.length - 1] as HTMLElement;
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  return (
    <section
      ref={ref}
      className="adp-end"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="adp-still-title"
      aria-describedby="adp-still-body"
      onKeyDown={onKeyDown}
    >
      <h2 id="adp-still-title" className="adp-end__title adp-end__title--lead">
        {msg('player.stillWatching.title')}
      </h2>
      <p id="adp-still-body" className="adp-end__meta">
        {msg('player.stillWatching.body', { title })}
      </p>
      <div className="adp-end__actions">
        <button type="button" className="adp-btn adp-btn--primary" onClick={onKeep}>
          {msg('player.stillWatching.keep')}
        </button>
        {stopHref ? (
          <a className="adp-btn adp-btn--ghost" href={stopHref} onClick={onStop}>
            {msg('player.stillWatching.stop')}
          </a>
        ) : (
          <button type="button" className="adp-btn adp-btn--ghost" onClick={onStop}>
            {msg('player.stillWatching.stop')}
          </button>
        )}
      </div>
    </section>
  );
}
