import { describe, expect, it } from 'vitest';
import { buildManifest, DEFAULT_PWA_SETTINGS, shortNameOf } from './manifest';

describe('buildManifest', () => {
  it('uses the platform name, colours and icons from settings', () => {
    const manifest = buildManifest({
      ...DEFAULT_PWA_SETTINGS,
      name: 'Hope Learning TV',
      tagline: 'Learn for free',
      themeColor: '#0A7D4B',
      backgroundColor: '#FFFFFF',
    });
    expect(manifest).toMatchObject({
      name: 'Hope Learning TV',
      description: 'Learn for free',
      theme_color: '#0A7D4B',
      background_color: '#FFFFFF',
      display: 'standalone',
      start_url: '/',
      scope: '/',
      id: '/',
    });
  });

  it('offers 192 and 512 icons plus a maskable one so the install prompt qualifies', () => {
    const icons = buildManifest(DEFAULT_PWA_SETTINGS).icons ?? [];
    const sizes = icons.map((icon) => `${icon.sizes}:${icon.purpose ?? 'any'}`);
    expect(sizes).toEqual(
      expect.arrayContaining(['192x192:any', '512x512:any', '512x512:maskable']),
    );
    expect(icons.every((icon) => icon.type === 'image/png')).toBe(true);
  });

  it('falls back to safe colours when a setting is not a hex colour', () => {
    const manifest = buildManifest({ ...DEFAULT_PWA_SETTINGS, themeColor: 'red; drop' });
    expect(manifest.theme_color).toBe(DEFAULT_PWA_SETTINGS.themeColor);
  });

  it('lets settings supply their own icon urls', () => {
    const manifest = buildManifest({
      ...DEFAULT_PWA_SETTINGS,
      icons: { any192: '/u/a192.png', any512: '/u/a512.png', maskable512: '/u/m512.png' },
    });
    expect(manifest.icons?.map((icon) => icon.src)).toEqual([
      '/u/a192.png',
      '/u/a512.png',
      '/u/m512.png',
    ]);
  });
});

describe('shortNameOf', () => {
  it('keeps short names and shortens long ones on a word boundary', () => {
    expect(shortNameOf('Angels TV')).toBe('Angels TV');
    expect(shortNameOf('Angels Delight TV')).toBe('Angels');
    expect(shortNameOf('Supercalifragilistic')).toBe('Supercalifra');
  });
});
