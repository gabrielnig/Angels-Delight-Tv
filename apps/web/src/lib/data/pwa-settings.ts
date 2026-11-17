import { DEFAULT_PWA_SETTINGS, type PwaSettings } from '../pwa/manifest';

/**
 * Data access for the PWA (docs: UI lanes build against typed interfaces first). The default implementation
 * returns the built in values. The integration pass replaces it with one that reads `platform.name`,
 * the theme colours and the logo assets from site settings (M29, M18).
 */
export interface PwaSettingsSource {
  get(): Promise<PwaSettings>;
}

export const fixturePwaSettings: PwaSettingsSource = {
  get: async () => DEFAULT_PWA_SETTINGS,
};

let source: PwaSettingsSource = fixturePwaSettings;

export function setPwaSettingsSource(next: PwaSettingsSource): void {
  source = next;
}

export function getPwaSettings(): Promise<PwaSettings> {
  return source.get();
}
