import { DEFAULT_PREFERENCES, PLAYBACK_RATES, type PlayerPreferences } from '@ad/player';

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const preferencesKey = (profileId: string) => `ad.player.prefs.${profileId}`;

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

/**
 * Per profile player preferences kept on this device (M08-S05 AC3, M11-S02).
 * Server side storage per profile arrives with M03-S09, behind the same shape.
 */
export function loadPreferences(
  store: KeyValueStore | null,
  profileId: string,
  profile: { kids: boolean },
  /** The profile's settings from the server. Choices made on this device win over them. */
  defaults: Partial<PlayerPreferences> = {},
): PlayerPreferences {
  let raw: string | null = null;
  try {
    raw = store?.getItem(preferencesKey(profileId)) ?? null;
  } catch {
    raw = null;
  }
  return { ...DEFAULT_PREFERENCES, captionsOn: profile.kids, ...defaults, ...parse(raw) };
}

export function savePreferences(
  store: KeyValueStore | null,
  profileId: string,
  prefs: PlayerPreferences,
): void {
  try {
    store?.setItem(preferencesKey(profileId), JSON.stringify(prefs));
  } catch {
    // Storage can be blocked or full. Preferences are a convenience.
  }
}
