'use client';

import { useCallback } from 'react';
import { toggleListAction } from '../../app/actions';
import { useProfileId } from '../profile-context';
import { toggleWithQueue, type ToggleOutcome } from './list-write';
import { createWriteQueue } from './write-queue';

/** A My List toggle that waits in the offline queue when there is no signal. */
export function useListToggle(): (itemKey: string, add: boolean) => Promise<ToggleOutcome> {
  const profileId = useProfileId();
  return useCallback(
    (itemKey, add) =>
      toggleWithQueue({
        toggle: toggleListAction,
        itemKey,
        add,
        profileId,
        online: navigator.onLine,
        queue: createWriteQueue(localStorage),
      }),
    [profileId],
  );
}
