import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../theme/root', () => ({
  getRootTheme: async () => ({
    injection: { themeColor: '#0A7A4B' },
    platformName: 'Sister V TV',
  }),
}));

import { DEFAULT_PWA_SETTINGS } from '../pwa/manifest';
import { fixturePwaSettings, getPwaSettings, themedPwaSettings } from './pwa-settings';

describe('pwa settings sources', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('themed settings take the name and colour from the published theme and settings', async () => {
    expect(await themedPwaSettings.get()).toEqual({
      ...DEFAULT_PWA_SETTINGS,
      name: 'Sister V TV',
      themeColor: '#0A7A4B',
    });
  });

  it('fixture settings are the built in defaults', async () => {
    expect(await fixturePwaSettings.get()).toEqual(DEFAULT_PWA_SETTINGS);
  });

  it('uses the defaults when viewer data is fixtures and the themed source when it is real', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('VIEWER_FIXTURES', 'on');
    expect((await getPwaSettings()).name).toBe(DEFAULT_PWA_SETTINGS.name);
    vi.stubEnv('NODE_ENV', 'production');
    expect((await getPwaSettings()).name).toBe('Sister V TV');
  });
});
