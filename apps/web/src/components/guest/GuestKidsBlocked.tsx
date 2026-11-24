'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { msg } from '@ad/shared/messages';
import { Button, ButtonLink, Icon } from '@ad/ui';
import '../title/title.css';

/** A guest in Kids mode opened a video that is not in the Kids library (M40-S09). */
export function GuestKidsBlocked({
  setKidsMode,
}: {
  setKidsMode: (kids: boolean) => Promise<void>;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div className="web-page tv">
      <div className="tv-state">
        <span className="tv-state__icon" data-tone="info">
          <Icon name="shield" size={28} />
        </span>
        <h1 className="tv-state__title">{msg('guest.kids.blocked.title')}</h1>
        <p className="tv-state__text">{msg('guest.kids.blocked.body')}</p>
        <div className="tv-state__actions">
          <ButtonLink href="/browse">{msg('guest.kids.browse')}</ButtonLink>
          <Button
            variant="secondary"
            loading={pending}
            onClick={() =>
              start(async () => {
                await setKidsMode(false);
                router.refresh();
              })
            }
          >
            {msg('guest.kids.turnOff')}
          </Button>
        </div>
      </div>
    </div>
  );
}
