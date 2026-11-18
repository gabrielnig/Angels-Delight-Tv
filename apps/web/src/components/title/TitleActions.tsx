'use client';

import { useState } from 'react';
import { Button, ButtonLink, useToast } from '@ad/ui';
import { toggleListAction } from '../../app/actions';
import type { PrimaryAction } from '../../lib/title-cta';

export interface TitleActionsProps {
  primary: PrimaryAction;
  itemKey: string;
  inList: boolean;
  /** Shown to other apps when the link is shared. Share is hidden when this is missing. */
  shareTitle?: string;
  toggle?: (itemKey: string, add: boolean) => Promise<void>;
}

/** Play, Resume or Watch again, Start over, an optimistic My List toggle and Share (M07, M10-S01). */
export function TitleActions({
  primary,
  itemKey,
  inList: initial,
  shareTitle,
  toggle = toggleListAction,
}: TitleActionsProps) {
  const [inList, setInList] = useState(initial);
  const [manualUrl, setManualUrl] = useState<string | null>(null);
  const toast = useToast();

  async function onToggle() {
    const next = !inList;
    setInList(next);
    try {
      await toggle(itemKey, next);
      toast.show({ message: next ? 'Added to My List' : 'Removed from My List', variant: 'success' });
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
      {manualUrl ? (
        <input
          className="web-title-actions__url"
          readOnly
          aria-label="Link to share"
          value={manualUrl}
          onFocus={(event) => event.currentTarget.select()}
        />
      ) : null}
    </div>
  );
}
