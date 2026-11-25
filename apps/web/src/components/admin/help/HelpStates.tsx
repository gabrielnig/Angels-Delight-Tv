'use client';

import { useEffect, useRef, useState } from 'react';
import { HELP_HOME } from '@/lib/admin/help-map';
import { Button, LinkButton } from '../Button';
import { Icon } from '../Icon';

/** True while the browser says it is online. Starts true so the server and first browser render agree. */
function useOnline(): boolean {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    setOnline(navigator.onLine !== false);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}

/** The page failed to load (S198). Focus goes to the heading, the message is an alert, one action, a small reference. */
export function HelpErrorView({ digest, reset }: { digest?: string; reset: () => void }) {
  const heading = useRef<HTMLHeadingElement>(null);
  const online = useOnline();
  useEffect(() => heading.current?.focus(), [online]);
  return (
    <div className="adm-error hlp-state" role="alert">
      <Icon name="alert" size={48} />
      <div>
        <h1 ref={heading} tabIndex={-1} className="adm-error__title hlp-state__title">
          {online ? 'We could not load this guide' : 'You are offline'}
        </h1>
        <p className="adm-error__help">
          {online
            ? 'Something went wrong on our side. Try again in a moment.'
            : 'This guide has not loaded on this device. Connect and try again.'}
        </p>
        {online && digest ? (
          <p className="adm-error__ref">Reference: AD-{digest.slice(0, 4).toUpperCase()}</p>
        ) : null}
      </div>
      <Button variant="secondary" icon="retry" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}

/** The guide does not exist (S198). One action. */
export function HelpNotFoundView() {
  return (
    <div className="adm-error hlp-state">
      <Icon name="book" size={48} />
      <div>
        <h1 className="adm-error__title hlp-state__title">We could not find that guide</h1>
        <p className="adm-error__help">
          It may have moved. Go back to the Help centre and search for it.
        </p>
      </div>
      <LinkButton href={HELP_HOME} variant="primary">
        Go to Help centre
      </LinkButton>
    </div>
  );
}

/** A quiet note at the top of every help page while the connection is down (S198). The page already open still works. */
export function HelpConnectionNote() {
  const online = useOnline();
  if (online) return null;
  return (
    <p className="hlp-offline hlp-noprint" role="status">
      <Icon name="alert" size={18} /> You are offline. Check your data or Wi-Fi. This page still
      works. Progress will save when you are back online.
    </p>
  );
}

const SKELETON_AFTER_MS = 300;
const SLOW_AFTER_MS = 6000;

/** The loading view for a help page: a skeleton after 300 ms and, after 6 s, a plain sentence instead of a spinner. */
export function HelpLoading() {
  const [skeleton, setSkeleton] = useState(false);
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const a = setTimeout(() => setSkeleton(true), SKELETON_AFTER_MS);
    const b = setTimeout(() => setSlow(true), SLOW_AFTER_MS);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
  }, []);
  return (
    <div className="hlp-loading">
      {skeleton ? (
        <div className="adm-skeleton" role="status" aria-busy="true" aria-label="Loading guide">
          <div className="adm-skeleton__row" style={{ height: '2rem', width: '60%' }} />
          <div className="adm-skeleton__row" style={{ height: '1.25rem', width: '80%' }} />
          <div className="adm-skeleton__row" style={{ height: '12rem' }} />
          <div className="adm-skeleton__row" style={{ height: '4rem' }} />
        </div>
      ) : null}
      {slow ? (
        <p role="status" className="hlp-slow">
          Still loading. Your connection may be slow. The video waits until you press Play.
        </p>
      ) : null}
    </div>
  );
}
