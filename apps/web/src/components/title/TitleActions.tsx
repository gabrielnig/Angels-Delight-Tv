'use client';

import { useT } from '../../lib/i18n/provider';
import { useState } from 'react';
import { Button, ButtonLink, useToast } from '@ad/ui';
import { ShareMenu } from '../share/ShareMenu';
import type { ShareChannelId } from '../share/share-links';
import { useListToggle } from '../../lib/pwa/useListToggle';
import { SignInToSaveDialog } from '../guest/SignInToSaveDialog';
import type { PrimaryAction } from '../../lib/title-cta';
import { useGuestPrimary, type GuestPlace } from './useGuestPrimary';

export interface TitleActionsProps {
  primary: PrimaryAction;
  itemKey: string;
  inList: boolean;
  /** Shown to other apps when the link is shared. Share is hidden when this is missing. */
  shareTitle?: string;
  /** The channels the admin enabled and the text that goes with the link. Defaults: WhatsApp, Facebook, X. */
  share?: { channels: ShareChannelId[]; text: string };
  /** A kids profile or Kids mode: no external links, so no Share (M45-S06 AC4). */
  kids?: boolean;
  /** Series pages say Share this series. */
  kind?: 'video' | 'series';
  toggle?: (itemKey: string, add: boolean) => Promise<void | 'sent' | 'queued'>;
  /** `title` is the two row layout of the title page (S18). The default is one wrapping row. */
  layout?: 'default' | 'title';
  /**
   * A visitor without an account (M40). My List opens the Sign in to save dialog and nothing is stored.
   * With `videoId` the main button follows the place saved on this device.
   */
  guest?: GuestPlace & { signUpOpen: boolean; next: string };
}

/** Play, Resume or Watch again, Start over, an optimistic My List toggle and Share (M07, M10-S01). */
export function TitleActions({
  primary: serverPrimary,
  itemKey,
  inList: initial,
  shareTitle,
  share,
  kids = false,
  kind = 'video',
  toggle: toggleProp,
  layout = 'default',
  guest,
}: TitleActionsProps) {
  const msg = useT();
  const primary = useGuestPrimary(serverPrimary, guest);
  const [saveOpen, setSaveOpen] = useState(false);
  const queued = useListToggle();
  const toggle = toggleProp ?? queued;
  const [inList, setInList] = useState(initial);
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
            ? msg('title.savedOffline')
            : next
              ? msg('title.addedToList')
              : msg('title.removedFromList'),
        variant: 'success',
      });
    } catch {
      setInList(!next);
      toast.show({ message: msg('title.updateFailed'), variant: 'error' });
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
      intent={{ kind: 'my-list', itemKey }}
      signUpOpen={guest.signUpOpen}
      onClose={() => setSaveOpen(false)}
    />
  ) : null;

  const shareMenu =
    shareTitle && !kids ? (
      <ShareMenu
        title={shareTitle}
        text={share?.text ?? shareTitle}
        channels={share?.channels ?? ['whatsapp', 'facebook', 'x']}
        kind={kind}
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
              {msg('title.startOver')}
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
            {inList && !guest ? msg('title.inMyList') : msg('title.myList')}
          </Button>
          {shareMenu}
        </div>
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
          {msg('title.startOver')}
        </ButtonLink>
      ) : null}
      <Button
        variant="secondary"
        icon={inList && !guest ? 'check' : 'plus'}
        {...listA11y}
        onClick={() => void onToggle()}
      >
        {msg('title.myList')}
      </Button>
      {shareMenu}
      {dialog}
    </div>
  );
}
