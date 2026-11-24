'use client';

import { useEffect, useRef } from 'react';
import { msg } from '@ad/shared/messages';
import { useToast } from '@ad/ui';
import { takeIntent } from '../../lib/guest/intent';
import { useListToggle } from '../../lib/pwa/useListToggle';

/**
 * After a visitor signs in, does the one thing they asked for before (M40-S06). Only a My List save is applied
 * here. A like is left for the code that owns likes.
 */
export function GuestIntentApplier() {
  const toggle = useListToggle();
  const toast = useToast();
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    const intent = takeIntent(window.localStorage, ['my-list']);
    if (!intent) return;
    toggle(intent.itemKey, true)
      .then((outcome) =>
        toast.show({
          message:
            outcome === 'queued'
              ? 'Saved on this device. It will sync when you are back online.'
              : msg('guest.myList.added'),
          variant: 'success',
        }),
      )
      .catch(() =>
        toast.show({ message: 'We could not update My List. Try again.', variant: 'error' }),
      );
  }, [toggle, toast]);
  return null;
}
