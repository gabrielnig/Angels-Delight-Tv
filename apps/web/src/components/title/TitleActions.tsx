'use client';

import { useState } from 'react';
import { Button, ButtonLink, useToast } from '@ad/ui';
import { useListToggle } from '../../lib/pwa/useListToggle';
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
}

/** Play, Resume or Watch again, Start over, an optimistic My List toggle and Share (M07, M10-S01). */
export function TitleActions({
  primary,
  itemKey,
  inList: initial,
  shareTitle,
  toggle: toggleProp,
  layout = 'default',
}: TitleActionsProps) {
  const queued = useListToggle();
  const toggle = toggleProp ?? queued;
  const [inList, setInList] = useState(initial);
  const [manualUrl, setManualUrl] = useState<string | null>(null);
  const toast = useToast();

  async function onToggle() {
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
            icon={inList ? 'check' : 'plus'}
            aria-pressed={inList}
            className="tv-actions__list"
            onClick={() => void onToggle()}
          >
            {inList ? 'In My List' : 'My List'}
          </Button>
          {shareTitle ? (
            <Button variant="secondary" icon="share" onClick={() => void onShare()}>
              Share
            </Button>
          ) : null}
        </div>
        {manual}
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
        icon={inList ? 'check' : 'plus'}
        aria-pressed={inList}
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
    </div>
  );
}
