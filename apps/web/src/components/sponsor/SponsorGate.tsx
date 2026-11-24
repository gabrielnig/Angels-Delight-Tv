'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { msg } from '@ad/shared/messages';
import type { SelectedSponsor } from '@ad/sponsors';
import { SponsorSurface } from './SponsorSurface';

/**
 * The card before a video (M48). The player is not mounted until the card is skipped or its time is up, so
 * nothing about the video is fetched meanwhile. Skip is a real button, visible at once. With no sponsor the
 * children render immediately.
 */
export function SponsorGate({
  sponsor,
  seconds,
  children,
}: {
  sponsor: SelectedSponsor | null | undefined;
  seconds: number;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(!sponsor);
  const [left, setLeft] = useState(seconds);
  useEffect(() => {
    if (open) return;
    const timer = setInterval(() => setLeft((n) => n - 1), 1000);
    return () => clearInterval(timer);
  }, [open]);
  useEffect(() => {
    if (left <= 0) setOpen(true);
  }, [left]);
  if (open || !sponsor) return <>{children}</>;
  return (
    <div className="sponsor-gate">
      <SponsorSurface sponsor={sponsor} variant="message" />
      <p className="sponsor-gate__count">{msg('sponsor.continueIn', { count: left })}</p>
      <button type="button" className="sponsor-gate__skip" onClick={() => setOpen(true)}>
        {msg('sponsor.skip')}
      </button>
    </div>
  );
}
