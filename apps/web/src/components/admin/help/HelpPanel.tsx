'use client';

import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import type { PanelData, PanelGuide } from '@/lib/admin/help-panel';
import { HELP_HOME } from '@/lib/admin/help-map';
import { Button, LinkButton } from '../Button';
import { Icon } from '../Icon';
import { ErrorState } from '../states';
import { clock, minutesLabel } from './format';
import { HelpVideo, type TranscriptCue } from './HelpVideo';
import { Inlines } from './render';

export type PanelView =
  | { phase: 'loading' }
  | { phase: 'error' }
  | { phase: 'ready'; data: PanelData; cues: TranscriptCue[] };

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),summary,video[controls],[tabindex]:not([tabindex="-1"])';

const SWIPE_CLOSE_PX = 60;

function GuideBlock({
  guide,
  main,
  cues,
  online,
  onWatched,
}: {
  guide: PanelGuide;
  main: boolean;
  cues: TranscriptCue[];
  online: boolean;
  onWatched: (guide: string) => Promise<{ ok: boolean }>;
}) {
  return (
    <section className="hlp-panel__guide" aria-labelledby={`hlp-panel-t-${guide.id}`}>
      <h3 id={`hlp-panel-t-${guide.id}`} className="hlp-panel__title">
        {guide.title}
      </h3>
      {guide.higher ? <p className="hlp-panel__higher">For a higher role</p> : null}
      <p className="hlp-panel__summary">{guide.summary}</p>
      <p className="hlp-panel__meta">
        <Icon name="clock" size={16} /> {minutesLabel(guide.readMinutes)}
        {guide.watchSeconds ? (
          <>
            {' '}
            <Icon name="video" size={16} /> {clock(guide.watchSeconds)}
          </>
        ) : null}
      </p>
      {main && guide.video ? (
        online ? (
          <HelpVideo
            guide={guide.id}
            videoId={guide.video.id}
            title={guide.title}
            phone={guide.video.phone}
            captions={guide.video.captions}
            cues={cues}
            watched={false}
            onWatched={onWatched}
          />
        ) : (
          <div className="hlp-panel__novideo">
            <p>
              <strong>The video needs data</strong>
            </p>
            <p>Read the steps below instead.</p>
          </div>
        )
      ) : null}
      {main ? (
        <ol className="hlp-panel__steps">
          {guide.steps.map((s) => (
            <li key={s.id} id={`hlp-panel-${s.id}`}>
              <Inlines nodes={s.c} />
            </li>
          ))}
        </ol>
      ) : null}
      <p>
        <LinkButton href={guide.href} variant={main ? 'primary' : 'secondary'}>
          Open the full guide
        </LinkButton>
      </p>
    </section>
  );
}

/**
 * The contextual help panel (S197): a side drawer from md and up, a bottom sheet on phones. It traps Tab, closes with
 * Escape, the Close button or a swipe down on the sheet handle, and the host returns focus to the opener.
 */
export function HelpPanel({
  view,
  online,
  showSkeleton,
  slow,
  section,
  onClose,
  onRetry,
  onWatched,
}: {
  view: PanelView;
  online: boolean;
  showSkeleton: boolean;
  slow: boolean;
  section?: string;
  onClose: () => void;
  onRetry: () => void;
  onWatched: (guide: string) => Promise<{ ok: boolean }>;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const touchY = useRef<number | null>(null);
  const [narrow, setNarrow] = useState(false);

  useEffect(() => {
    ref.current?.focus();
  }, []);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const q = window.matchMedia('(max-width: 59.9375rem)');
    setNarrow(q.matches);
    const on = (e: MediaQueryListEvent) => setNarrow(e.matches);
    q.addEventListener('change', on);
    return () => q.removeEventListener('change', on);
  }, []);

  useEffect(() => {
    if (view.phase !== 'ready' || !section) return;
    document.getElementById(`hlp-panel-${section}`)?.scrollIntoView?.({ block: 'start' });
  }, [view.phase, section]);

  const trap = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Tab' || !ref.current) return;
    const items = [...ref.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
    if (!items.length) return;
    const first = items[0] as HTMLElement;
    const last = items[items.length - 1] as HTMLElement;
    const active = document.activeElement;
    if (e.shiftKey && (active === first || active === ref.current)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const guides = view.phase === 'ready' ? view.data.guides : [];

  return (
    <div className="hlp-panel-wrap">
      <div className="hlp-panel-scrim" onClick={onClose} aria-hidden="true" />
      <div
        ref={ref}
        role="dialog"
        aria-modal={narrow ? 'true' : 'false'}
        aria-label="Help for this screen"
        tabIndex={-1}
        className="hlp-panel"
        onKeyDown={trap}
      >
        <div
          className="hlp-panel__handle"
          data-testid="help-sheet-handle"
          aria-hidden="true"
          onTouchStart={(e) => {
            touchY.current = e.touches[0]?.clientY ?? null;
          }}
          onTouchEnd={(e) => {
            const start = touchY.current;
            touchY.current = null;
            const end = e.changedTouches[0]?.clientY;
            if (start !== null && end !== undefined && end - start > SWIPE_CLOSE_PX) onClose();
          }}
        >
          <span />
        </div>
        <header className="hlp-panel__head">
          <h2 className="hlp-panel__heading">Help for this screen</h2>
          <button
            type="button"
            className="adm-btn adm-btn--ghost hlp-panel__close"
            aria-label="Close help"
            onClick={onClose}
          >
            <Icon name="close" />
          </button>
        </header>
        <div className="hlp-panel__body">
          {!online && view.phase === 'ready' ? (
            <p className="hlp-panel__offline" role="status">
              You are offline. Check your data or Wi-Fi. This summary is saved on your device.
            </p>
          ) : null}
          {view.phase === 'loading' ? (
            <>
              {showSkeleton ? (
                <div className="hlp-panel__skeleton" role="status" aria-busy="true" aria-label="Loading help">
                  <div className="adm-skeleton__row" style={{ height: '1.5rem' }} />
                  <div className="adm-skeleton__row" style={{ height: '4rem' }} />
                  <div className="adm-skeleton__row" style={{ height: '3rem' }} />
                </div>
              ) : null}
              {slow ? <p role="status">Still loading. Your connection may be slow.</p> : null}
            </>
          ) : null}
          {view.phase === 'error' ? (
            <ErrorState
              compact
              title={online ? 'We could not load this guide' : 'You are offline'}
              help={
                online
                  ? 'Something went wrong on our side. Try again in a moment.'
                  : 'This guide is not saved on this device yet. Connect once and open it to keep a copy.'
              }
              onRetry={onRetry}
            />
          ) : null}
          {view.phase === 'ready' && guides.length === 0 ? (
            <div className="hlp-panel__none">
              <h3 className="hlp-panel__title">No guide for this screen yet</h3>
              <p>Search the help, or look through all the guides.</p>
              <form action={`${HELP_HOME}/search`} method="get" role="search" className="hlp-panel__search">
                <label htmlFor="hlp-panel-q" className="hlp-panel__label">
                  Search help
                </label>
                <input id="hlp-panel-q" type="search" name="q" className="adm-input" autoComplete="off" />
                <Button type="submit" variant="secondary" icon="search">
                  Search
                </Button>
              </form>
              {view.data.core.length ? (
                <ul className="hlp-panel__core">
                  {view.data.core.map((c) => (
                    <li key={c.id}>
                      <a href={c.href}>{c.title}</a>
                    </li>
                  ))}
                </ul>
              ) : null}
              <LinkButton href={HELP_HOME} variant="primary">
                Browse all guides
              </LinkButton>
            </div>
          ) : null}
          {view.phase === 'ready'
            ? guides.map((g, i) => (
                <GuideBlock
                  key={g.id}
                  guide={g}
                  main={i === 0}
                  cues={view.cues}
                  online={online}
                  onWatched={onWatched}
                />
              ))
            : null}
        </div>
        <footer className="hlp-panel__foot">
          <a href={HELP_HOME}>See all help</a>
        </footer>
      </div>
    </div>
  );
}
