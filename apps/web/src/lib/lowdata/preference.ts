export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const dataSaverKey = (profileId: string | null): string =>
  `ad.datasaver.${profileId ?? 'guest'}`;

export function readStoredPreference(
  store: KeyValueStore,
  profileId: string | null,
): boolean | null {
  try {
    const value = store.getItem(dataSaverKey(profileId));
    return value === 'on' ? true : value === 'off' ? false : null;
  } catch {
    return null;
  }
}

export function writePreference(store: KeyValueStore, profileId: string | null, on: boolean): void {
  try {
    store.setItem(dataSaverKey(profileId), on ? 'on' : 'off');
  } catch {
    // Private mode or blocked storage: the choice lasts for this page only.
  }
}

export interface DataSaverState {
  on: boolean;
  source: 'user' | 'browser' | 'default';
  /** True when the browser turned it on and the viewer has not been told yet. */
  announce: boolean;
}

/** The viewer's saved choice wins. Without one, a Save-Data or slow link turns it on once and says so. */
export function resolveDataSaver(input: {
  stored: boolean | null;
  browserWantsSaving: boolean;
}): DataSaverState {
  if (input.stored !== null) return { on: input.stored, source: 'user', announce: false };
  if (input.browserWantsSaving) return { on: true, source: 'browser', announce: true };
  return { on: false, source: 'default', announce: false };
}
