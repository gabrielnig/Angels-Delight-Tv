import { realDataEnabled } from '../../server/data/mode';
import { DEFAULT_PWA_SETTINGS, type PwaSettings } from '../pwa/manifest';

/**
 * Data access for the PWA. Real data mode reads `platform.name` and the theme colour from the lane H runtime
 * (`themedPwaSettings`). Fixture mode returns the built in values. Icons are still the built in set until a
 * logo derived icon pipeline exists (M25-S01 AC2).
 */
export interface PwaSettingsSource {
  get(): Promise<PwaSettings>;
}

export const fixturePwaSettings: PwaSettingsSource = {
  get: async () => DEFAULT_PWA_SETTINGS,
};

export const themedPwaSettings: PwaSettingsSource = {
  async get() {
    // Loaded on demand so fixture mode and unit tests never pull in the theme runtime.
    const { getRootTheme } = await import('../theme/root');
    const theme = await getRootTheme();
    return {
      ...DEFAULT_PWA_SETTINGS,
      name: theme.platformName,
      themeColor: theme.injection.themeColor,
    };
  },
};

export function getPwaSettings(): Promise<PwaSettings> {
  return (realDataEnabled() ? themedPwaSettings : fixturePwaSettings).get();
}
