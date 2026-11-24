'use client';

import { useState } from 'react';
import { Button, useToast, type IconName } from '@ad/ui';
import { msg } from '@ad/shared/messages';

export type RatingValue = -1 | 1 | 2;

export interface RatingControlProps {
  /** The profile's current rating, or null when never rated. */
  initial: RatingValue | null;
  /** Saves the value, or null to clear. Rejects when the server refuses. */
  save: (value: RatingValue | null) => Promise<void>;
  /** A visitor without an account: a click asks to sign in and nothing is stored (M44-S04). */
  guest?: boolean;
  onGuestAsk?: (value: RatingValue) => void;
  /** The title was unpublished meanwhile (M44-S01 error). */
  unavailable?: boolean;
}

const LEVELS: ReadonlyArray<{ value: RatingValue; icon: IconName; label: () => string }> = [
  { value: -1, icon: 'thumbDown', label: () => msg('engage.rating.notForMe') },
  { value: 1, icon: 'thumbUp', label: () => msg('engage.rating.like') },
  { value: 2, icon: 'heart', label: () => msg('engage.rating.love') },
];

/** Not for me, Like, Love as a group of toggle buttons. Optimistic, rolls back on failure, Undo when cleared. */
export function RatingControl({ initial, save, guest, onGuestAsk, unavailable }: RatingControlProps) {
  const [value, setValue] = useState<RatingValue | null>(initial);
  const toast = useToast();

  async function change(next: RatingValue | null, previous: RatingValue | null, undo = false) {
    setValue(next);
    try {
      await save(next);
      toast.show({
        message: next === null ? msg('engage.rating.cleared') : msg('engage.rating.saved'),
        variant: 'success',
        action:
          next === null && !undo && previous !== null
            ? {
                label: msg('engage.rating.undo'),
                onClick: () => void change(previous, null, true),
              }
            : undefined,
      });
    } catch {
      setValue(previous);
      toast.show({ message: msg('engage.rating.error'), variant: 'error' });
    }
  }

  function onPick(level: RatingValue) {
    if (guest) {
      onGuestAsk?.(level);
      return;
    }
    void change(value === level ? null : level, value);
  }

  return (
    <div className="ad-rating">
      <div role="group" aria-label={msg('engage.rating.group')} className="ad-rating__group">
        {LEVELS.map((level) => {
          const pressed = !guest && value === level.value;
          return (
            <Button
              key={level.value}
              variant={pressed ? 'primary' : 'secondary'}
              icon={level.icon}
              aria-pressed={pressed}
              disabled={unavailable}
              className="ad-rating__btn"
              onClick={() => onPick(level.value)}
            >
              <span className="ad-rating__label">{level.label()}</span>
            </Button>
          );
        })}
      </div>
      {unavailable ? (
        <p role="status" className="ad-rating__note">
          {msg('engage.rating.unavailable')}
        </p>
      ) : null}
    </div>
  );
}
