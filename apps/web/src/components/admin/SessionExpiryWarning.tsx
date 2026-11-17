'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Button, LinkButton } from './Button';
import { Dialog } from './Dialog';

/** Minutes and seconds left, for example "1:59". */
export function countdownLabel(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Warns before an admin session ends from inactivity (M01-S12). The server sends how long is left at the
 * moment the page was made, so a wrong clock on this computer cannot change the countdown. Any page change
 * sends a new value and starts the countdown again. Moving to another page counts as activity too, because
 * every admin page asks the server for the session, which restarts the idle timer there.
 */
export function SessionExpiryWarning({
  remainingMs,
  idleMs,
  absoluteMs,
  warnMs = 2 * 60_000,
  extend,
  signInHref,
}: {
  remainingMs: number;
  /** The full idle period, used to restart the countdown on a page change. */
  idleMs: number;
  /** Time left before the hard daily limit, which no activity can extend. */
  absoluteMs: number;
  warnMs?: number;
  /** Asks the server for more time. Resolves null when the session is already gone. */
  extend: () => Promise<{ remainingMs: number } | null>;
  signInHref: string;
}) {
  const pathname = usePathname();
  const deadline = useRef(performance.now() + remainingMs);
  const hardStop = useRef(performance.now() + absoluteMs);
  const lastPath = useRef(pathname);
  const [left, setLeft] = useState(remainingMs);
  const [busy, setBusy] = useState(false);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    deadline.current = performance.now() + remainingMs;
    hardStop.current = performance.now() + absoluteMs;
    setLeft(remainingMs);
    setGone(false);
  }, [remainingMs, absoluteMs]);

  useEffect(() => {
    if (lastPath.current === pathname) return;
    lastPath.current = pathname;
    deadline.current = Math.min(performance.now() + idleMs, hardStop.current);
    setLeft(deadline.current - performance.now());
  }, [pathname, idleMs]);

  useEffect(() => {
    const timer = setInterval(() => setLeft(deadline.current - performance.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const ended = gone || left <= 0;
  const warning = !ended && left <= warnMs;

  async function stay() {
    setBusy(true);
    try {
      const next = await extend();
      if (!next) {
        setGone(true);
        return;
      }
      deadline.current = Math.min(performance.now() + next.remainingMs, hardStop.current);
      setLeft(deadline.current - performance.now());
    } catch {
      // The session may still be valid. The countdown goes on and the person can try again.
    } finally {
      setBusy(false);
    }
  }

  if (ended) {
    return (
      <Dialog
        open
        onClose={() => undefined}
        title="You were signed out"
        description="Your session ended after a period without activity. Sign in again to carry on. Anything you had not saved is lost."
        size="sm"
        footer={
          <LinkButton href={signInHref} variant="primary">
            Sign in again
          </LinkButton>
        }
      />
    );
  }
  return (
    <Dialog
      open={warning}
      onClose={() => void stay()}
      title="You will be signed out soon"
      description="For your safety, admin sessions end after 30 minutes without activity."
      size="sm"
      footer={
        <Button variant="primary" loading={busy} onClick={() => void stay()}>
          Stay signed in
        </Button>
      }
    >
      <p className="adm-h2" style={{ margin: 0 }}>
        {countdownLabel(left)}
      </p>
    </Dialog>
  );
}
