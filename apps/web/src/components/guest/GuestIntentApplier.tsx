'use client';

import { useEffect, useRef } from 'react';
import { msg } from '@ad/shared/messages';
import { useToast } from '@ad/ui';
import { useProfileId } from '../../lib/profile-context';
import { takeIntent } from '../../lib/guest/intent';
import { useListToggle } from '../../lib/pwa/useListToggle';

/**
 * After a visitor signs in, does the one thing they asked for before (M40-S06): a My List save, or the rating
 * they picked (M44-S04). A like without a value is dropped, there is nothing to replay.
 */
export function GuestIntentApplier() {
  const toggle = useListToggle();
  const toast = useToast();
  const profileId = useProfileId();
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    const intent = takeIntent(window.localStorage, ['my-list', 'like']);
    if (!intent) return;
    if (intent.kind === 'like') {
      if (!intent.value || !profileId) return;
      const [kind, id] = intent.itemKey.split(':') as ['video' | 'series', string];
      fetch('/api/ratings', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ profileId, target: { kind, id }, value: intent.value }),
      })
        .then((response) => {
          if (!response.ok) throw new Error(String(response.status));
          toast.show({ message: msg('engage.rating.saved'), variant: 'success' });
        })
        .catch(() => toast.show({ message: msg('engage.rating.error'), variant: 'error' }));
      return;
    }
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
  }, [toggle, toast, profileId]);
  return null;
}
