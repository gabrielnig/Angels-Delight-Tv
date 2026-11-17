'use client';

import { useState } from 'react';
import { Button, ButtonLink, useToast } from '@ad/ui';
import { toggleListAction } from '../../app/actions';

export interface TitleActionsProps {
  watchHref: string;
  itemKey: string;
  inList: boolean;
  resume?: { timeLeft: string };
  toggle?: (itemKey: string, add: boolean) => Promise<void>;
}

/** Play or Continue, Start over, and an optimistic My List toggle. */
export function TitleActions({
  watchHref,
  itemKey,
  inList: initial,
  resume,
  toggle = toggleListAction,
}: TitleActionsProps) {
  const [inList, setInList] = useState(initial);
  const toast = useToast();

  async function onToggle() {
    const next = !inList;
    setInList(next);
    try {
      await toggle(itemKey, next);
    } catch {
      setInList(!next);
      toast.show({ message: 'We could not update My List. Try again.', variant: 'error' });
    }
  }

  return (
    <div className="web-title-actions">
      {resume ? (
        <>
          <ButtonLink href={watchHref} icon="play" aria-label={`Continue, ${resume.timeLeft}`}>
            Continue
          </ButtonLink>
          <ButtonLink href={`${watchHref}?start=0`} variant="secondary">
            Start over
          </ButtonLink>
        </>
      ) : (
        <ButtonLink href={watchHref} icon="play">
          Play
        </ButtonLink>
      )}
      <Button
        variant="secondary"
        icon={inList ? 'check' : 'plus'}
        aria-pressed={inList}
        onClick={() => void onToggle()}
      >
        My List
      </Button>
    </div>
  );
}
