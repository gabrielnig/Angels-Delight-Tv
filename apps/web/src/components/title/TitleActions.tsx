'use client';

import { useState } from 'react';
import { useEffect } from 'react';
import { Button, ButtonLink, useToast } from '@ad/ui';
import { readGuestProgress } from '../../lib/guest/progress-store';
import { guestPrimary } from '../../lib/guest/resume';
import { useListToggle } from '../../lib/pwa/useListToggle';
import { SignInToSaveDialog } from '../guest/SignInToSaveDialog';
import type { PrimaryAction } from '../../lib/title-cta';

export interface TitleActionsProps {
  primary: PrimaryAction;
  itemKey: string;
  inList: boolean;
  /** Shown to other apps when the link is shared. Share is hidden when this is missing. */
  shareTitle?: string;
  toggle?: (itemKey: string, add: boolean) => Promise<void | 'sent' | 'queued'>;
  /** `title` is the two row layout of the title page (S18). The default is one wrapping row. */
  layout?: 'default' | 'title';
  /**
   * A visitor without an account (M40). My List opens the Sign in to save dialog and nothing is stored.
   * With `videoId` the main button follows the place saved on this device.
   */
  guest?: { signUpOpen: boolean; next: string; videoId?: string; durationSeconds?: number };
}

/** Play, Resume or Watch again, Start over, an optimistic My List toggle and Share (M07, M10-S01). */
export function TitleActions({
  primary: serverPrimary,
  itemKey,
  inList: initial,
  shareTitle,
  toggle: toggleProp,
  layout = 'default',
  guest,
}: TitleActionsProps) {
  const [primary, setPrimary] = useState(serverPrimary);
  const [saveOpen, setSaveOpen] = useState(false);
  const guestVideo = guest?.videoId;
  const guestDuration = guest?.durationSeconds ?? 0;
  useEffect(() => {
    if (!guestVideo) return;
    const entry = readGuestProgress(window.localStorage, guestVideo);
    setPrimary(
      guestPrimary({ watchHref: serverPrimary.href, durationSeconds: guestDuration }, entry),
    );
  }, [guestVideo, guestDuration, serverPrimary.href]);
  const queued = useListToggle();
  const toggle = toggleProp ?? queued;
  const [inList, setInList] = useState(initial);
  const [manualUrl, setManualUrl] = useState<string | null>(null);
  const toast = useToast();

  async function onToggle() {
    if (guest) {
      setSaveOpen(true);
      return;
    }
    const next = !inList;
    setInList(next);
    try {
      const outcome = await toggle(itemKey, next);
      toast.show({
        message:
          outcome === 'queued'
            ? 'Saved on this device. It will sync when you are back online.'
            : next
              ? 'Added to My List'
              : 'Removed from My List',
        variant: 'success',
      });
    } catch {
      setInList(!next);
      toast.show({ message: 'We could not update My List. Try again.', variant: 'error' });
    }
  }

  async function onShare() {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: shareTitle, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setManualUrl(null);
      toast.show({ message: 'Link copied', variant: 'success' });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setManualUrl(url);
    }
  }

  const listA11y = guest
    ? ({ 'aria-haspopup': 'dialog' } as const)
    : ({ 'aria-pressed': inList } as const);
  const dialog = guest ? (
    <SignInToSaveDialog
      open={saveOpen}
      reason="my-list"
      next={guest.next}
      signUpOpen={guest.signUpOpen}
      onClose={() => setSaveOpen(false)}
    />
  ) : null;

  const manual = manualUrl ? (
    <input
      className="web-title-actions__url"
      readOnly
      aria-label="Link to share"
      value={manualUrl}
      onFocus={(event) => event.currentTarget.select()}
    />
  ) : null;

  if (layout === 'title') {
    return (
      <div className="tv-actions">
        <div className="tv-actions__row tv-actions__row--play">
          <ButtonLink href={primary.href} icon="play" size="lg" className="tv-actions__primary">
            {primary.text}
          </ButtonLink>
          {primary.startOverHref ? (
            <ButtonLink href={primary.startOverHref} variant="secondary" size="lg" icon="retry">
              Start over
            </ButtonLink>
          ) : null}
        </div>
        <div className="tv-actions__row">
          <Button
            variant="secondary"
            icon={inList && !guest ? 'check' : 'plus'}
            {...listA11y}
            className="tv-actions__list"
            onClick={() => void onToggle()}
          >
            {inList && !guest ? 'In My List' : 'My List'}
          </Button>
          {shareTitle ? (
            <Button variant="secondary" icon="share" onClick={() => void onShare()}>
              Share
            </Button>
          ) : null}
        </div>
        {manual}
        {dialog}
      </div>
    );
  }

  return (
    <div className="web-title-actions">
      <ButtonLink href={primary.href} icon="play">
        {primary.text}
      </ButtonLink>
      {primary.startOverHref ? (
        <ButtonLink href={primary.startOverHref} variant="secondary">
          Start over
        </ButtonLink>
      ) : null}
      <Button
        variant="secondary"
        icon={inList && !guest ? 'check' : 'plus'}
        {...listA11y}
        onClick={() => void onToggle()}
      >
        My List
      </Button>
      {shareTitle ? (
        <Button variant="secondary" onClick={() => void onShare()}>
          Share
        </Button>
      ) : null}
      {manual}
      {dialog}
    </div>
  );
}
