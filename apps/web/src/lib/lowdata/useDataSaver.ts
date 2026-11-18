'use client';

import { useCallback, useEffect, useState } from 'react';
import { prefersDataSaverByDefault, type NavigatorLike } from './connection';
import { readStoredPreference, resolveDataSaver, writePreference } from './preference';

const announcedKey = (profileId: string | null) => `ad.datasaver.told.${profileId ?? 'guest'}`;

export interface UseDataSaverOptions {
  /** Called after a manual change, so the profile service can persist it server side (M25-S03 AC3). */
  onChange?: (on: boolean) => void;
  /** The profile's own Data saver choice from the server. When on, it applies on every device. */
  profileSetting?: boolean;
}

/**
 * Data saver state for the current profile. The first render is off so server and client markup match,
 * then the saved choice or the browser signal applies. Toggling takes effect at once.
 */
export function useDataSaver(profileId: string | null, options: UseDataSaverOptions = {}) {
  const [state, setState] = useState({ on: false, announce: false });
  const { onChange, profileSetting } = options;

  useEffect(() => {
    const resolved = resolveDataSaver({
      stored: readStoredPreference(localStorage, profileId),
      browserWantsSaving: prefersDataSaverByDefault(navigator as NavigatorLike),
    });
    let told = false;
    try {
      told = localStorage.getItem(announcedKey(profileId)) === '1';
    } catch {
      told = false;
    }
    setState({
      on: resolved.on || profileSetting === true,
      announce: resolved.announce && !told && profileSetting !== true,
    });
  }, [profileId, profileSetting]);

  const setOn = useCallback(
    (on: boolean) => {
      writePreference(localStorage, profileId, on);
      setState((current) => ({ ...current, on }));
      onChange?.(on);
    },
    [profileId, onChange],
  );

  const dismissAnnouncement = useCallback(() => {
    try {
      localStorage.setItem(announcedKey(profileId), '1');
    } catch {
      // Blocked storage: the notice may show again next visit.
    }
    setState((current) => ({ ...current, announce: false }));
  }, [profileId]);

  return { on: state.on, announce: state.announce, setOn, dismissAnnouncement };
}
