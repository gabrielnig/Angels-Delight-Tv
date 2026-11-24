import { DEFAULT_PREFERENCES, PLAYBACK_RATES, type PlayerPreferences } from '@ad/player';

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const preferencesKey = (profileId: string) => `ad.player.prefs.${profileId}`;

/** Fields the server keeps per profile. The device keeps only volume and mute (M03-S09, D-108 (M2)). */
export interface ServerPreferenceFields {
  rate: number;
  captionsOn: boolean;
  captionLanguage: string;
  dataSaver: boolean;
  autoplayNext: boolean;
}

/** The names the profile service uses for the same fields. */
export interface ServerPatch {
  speed?: number;
  captionsDefault?: boolean;
  captionLanguage?: string;
  dataSaver?: boolean;
  autoplayNext?: boolean;
}

function parse(raw: string | null): Partial<PlayerPreferences> {
  if (!raw) return {};
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return {};
  }
  if (typeof value !== 'object' || value === null) return {};
  const v = value as Record<string, unknown>;
  const out: Partial<PlayerPreferences> = {};
  if (typeof v.volume === 'number' && v.volume >= 0 && v.volume <= 1) out.volume = v.volume;
  if (typeof v.muted === 'boolean') out.muted = v.muted;
  if (typeof v.rate === 'number' && (PLAYBACK_RATES as readonly number[]).includes(v.rate))
    out.rate = v.rate;
  if (typeof v.captionsOn === 'boolean') out.captionsOn = v.captionsOn;
  if (typeof v.captionLanguage === 'string') out.captionLanguage = v.captionLanguage;
  if (typeof v.dataSaver === 'boolean') out.dataSaver = v.dataSaver;
  if (typeof v.autoplayNext === 'boolean') out.autoplayNext = v.autoplayNext;
  return out;
}

function read(store: KeyValueStore | null, profileId: string): Partial<PlayerPreferences> {
  try {
    return parse(store?.getItem(preferencesKey(profileId)) ?? null);
  } catch {
    return {};
  }
}

/**
 * Player preferences for one profile (M08-S05 AC3, M11-S02, M03-S09). Speed, captions, data saver and autoplay
 * come from the profile on the server, so they follow the person to every device. Volume and mute are about the
 * device, so they stay in this browser.
 */
export function loadPreferences(
  store: KeyValueStore | null,
  profileId: string,
  profile: { kids: boolean },
  /** The profile's settings from the server. */
  defaults: Partial<PlayerPreferences> = {},
): PlayerPreferences {
  const local = read(store, profileId);
  return {
    ...DEFAULT_PREFERENCES,
    captionsOn: profile.kids,
    ...defaults,
    ...(local.volume !== undefined ? { volume: local.volume } : {}),
    ...(local.muted !== undefined ? { muted: local.muted } : {}),
  };
}

/** Saves the device fields only. Everything else goes to the server. */
export function savePreferences(
  store: KeyValueStore | null,
  profileId: string,
  prefs: PlayerPreferences,
): void {
  try {
    store?.setItem(
      preferencesKey(profileId),
      JSON.stringify({ volume: prefs.volume, muted: prefs.muted }),
    );
  } catch {
    // Storage can be blocked or full. Preferences are a convenience.
  }
}

/**
 * Values an older version kept in this browser for the server owned fields, under the server's names, or null
 * when there are none. They move to the server once (see `migrateDevicePlayback`).
 */
export function readLegacyPreferences(
  store: KeyValueStore | null,
  profileId: string,
): ServerPatch | null {
  const local = read(store, profileId);
  const out: ServerPatch = {};
  if (local.rate !== undefined) out.speed = local.rate;
  if (local.captionsOn !== undefined) out.captionsDefault = local.captionsOn;
  if (local.captionLanguage !== undefined) out.captionLanguage = local.captionLanguage;
  if (local.dataSaver !== undefined) out.dataSaver = local.dataSaver;
  if (local.autoplayNext !== undefined) out.autoplayNext = local.autoplayNext;
  return Object.keys(out).length > 0 ? out : null;
}

/** Removes the moved fields from this browser and keeps volume and mute. */
export function clearLegacyPreferences(store: KeyValueStore | null, profileId: string): void {
  const local = read(store, profileId);
  try {
    store?.setItem(
      preferencesKey(profileId),
      JSON.stringify({
        ...(local.volume !== undefined ? { volume: local.volume } : {}),
        ...(local.muted !== undefined ? { muted: local.muted } : {}),
      }),
    );
  } catch {
    // Nothing to clean when storage is blocked.
  }
}

/** The server fields that differ between two states, under the server's names. */
export function serverChanges(before: PlayerPreferences, after: PlayerPreferences): ServerPatch {
  const out: ServerPatch = {};
  if (before.rate !== after.rate) out.speed = after.rate;
  if (before.captionsOn !== after.captionsOn) out.captionsDefault = after.captionsOn;
  if (before.captionLanguage !== after.captionLanguage) out.captionLanguage = after.captionLanguage;
  if (before.dataSaver !== after.dataSaver) out.dataSaver = after.dataSaver;
  if (before.autoplayNext !== after.autoplayNext) out.autoplayNext = after.autoplayNext;
  return out;
}
