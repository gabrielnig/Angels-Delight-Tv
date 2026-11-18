'use client';

import { msg } from '@ad/shared/messages';
import { useEffect, useState, type ComponentProps } from 'react';
import type { Profile } from '../../lib/data';
import {
  readPickerCache,
  savePickerCache,
  type PickerProfile,
} from '../../lib/profiles/picker-cache';
import { ProfilePicker } from './ProfilePicker';

type PickerProps = Omit<
  ComponentProps<typeof ProfilePicker>,
  'profiles' | 'loading' | 'error' | 'onSelect'
> & { onSelect: (profile: PickerProfile) => void };

/**
 * The picker with a local cache behind it (M03-S13). A fresh list is drawn and saved for the next visit. When the
 * refresh failed (`fresh` is null) the cached list from the last visit is drawn with a small "May be out of date"
 * note, and without a usable cache the error state with Retry shows.
 */
export function CachedPicker({
  accountId,
  fresh,
  now = Date.now,
  onSelect,
  ...picker
}: PickerProps & {
  accountId: string;
  /** The loaded list, null when the refresh failed, or 'loading' while the server still answers. */
  fresh: Profile[] | null | 'loading';
  now?: () => number;
}) {
  const [cached, setCached] = useState<PickerProfile[] | null>(null);
  const [checked, setChecked] = useState(fresh !== null && fresh !== 'loading');

  useEffect(() => {
    if (Array.isArray(fresh)) {
      savePickerCache(localStorage, accountId, fresh, now());
      return;
    }
    try {
      setCached(readPickerCache(localStorage, accountId, now())?.profiles ?? null);
    } catch {
      setCached(null);
    }
    setChecked(true);
    // Runs once for the list the page loaded with.
  }, []);

  const pick = (list: PickerProfile[]) => (id: string) => {
    const profile = list.find((p) => p.id === id);
    if (profile) onSelect(profile);
  };
  if (Array.isArray(fresh))
    return <ProfilePicker {...picker} profiles={fresh} onSelect={pick(fresh)} />;
  if (!checked) return <ProfilePicker {...picker} profiles={[]} loading onSelect={pick([])} />;
  if (!cached && fresh === 'loading')
    return <ProfilePicker {...picker} profiles={[]} loading onSelect={pick([])} />;
  if (!cached) return <ProfilePicker {...picker} profiles={[]} error onSelect={pick([])} />;
  return (
    <ProfilePicker
      {...picker}
      onSelect={pick(cached)}
      autoSkip={false}
      profiles={cached.map(toProfile)}
      note={fresh === 'loading' ? msg('profiles.cache.refreshing') : msg('profiles.cache.stale')}
    />
  );
}

const toProfile = (p: PickerProfile): Profile => ({
  language: 'en',
  autoplayNext: true,
  owner: false,
  ...p,
});
