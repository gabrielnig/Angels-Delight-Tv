import { describe, expect, it } from 'vitest';
import {
  LogoUploader,
  MemoryAssetStore,
  MemorySettingsStore,
  MemoryThemeStore,
  SettingsService,
  ThemeService,
  DEFAULT_THEME,
} from '@ad/theme';
import { createLogger } from '@ad/shared';
import { emailBrandFrom } from './email-brand';

const logger = createLogger();

function rt() {
  const assets = new MemoryAssetStore();
  return {
    theme: new ThemeService({ store: new MemoryThemeStore(), logger }),
    settings: new SettingsService({ store: new MemorySettingsStore(), logger }),
    logos: new LogoUploader({ storage: {} as never, assets }),
    assets,
    logger,
  };
}

describe('emailBrandFrom', () => {
  it('uses the default name and theme colours before anything is published', async () => {
    const brand = await emailBrandFrom(rt() as never, 'https://media.example.org');
    expect(brand.appName).toBe('Angels Delight TV');
    expect(brand.primaryColor).toBe(DEFAULT_THEME.colors.primary);
    expect(brand.backgroundColor).toBe(DEFAULT_THEME.colors.bg);
    expect(brand.logoUrl).toBeUndefined();
  });

  it('follows the platform name setting', async () => {
    const r = { ...rt(), settings: { get: async () => 'Sunrise TV' } };
    const brand = await emailBrandFrom(r as never, 'https://media.example.org');
    expect(brand.appName).toBe('Sunrise TV');
  });

  it('builds the logo link from the published logo variant', async () => {
    const r = rt();
    const logos = {
      get: async () => ({
        id: 'logo-1',
        variants: [
          { width: 200, height: 50, key: 'img/logo-1/200-aaaaaaaa.webp', bytes: 1 },
          { width: 400, height: 100, key: 'img/logo-1/400-bbbbbbbb.webp', bytes: 1 },
        ],
      }),
    };
    const theme = {
      getPublished: async () => ({ ...(await r.theme.getPublished()), logoAssetId: 'logo-1' }),
    };
    const brand = await emailBrandFrom(
      { ...r, theme, logos } as never,
      'https://media.example.org/',
    );
    expect(brand.logoUrl).toBe('https://media.example.org/img/logo-1/400-bbbbbbbb.webp');
  });

  it('never throws, an unreadable theme gives the plain default', async () => {
    const broken = {
      theme: {
        getPublished: async () => {
          throw new Error('down');
        },
      },
      settings: {
        get: async () => {
          throw new Error('down');
        },
      },
      logos: { get: async () => null },
      logger,
    };
    const brand = await emailBrandFrom(broken as never, 'https://media.example.org');
    expect(brand.appName).toBe('Angels Delight TV');
  });
});
