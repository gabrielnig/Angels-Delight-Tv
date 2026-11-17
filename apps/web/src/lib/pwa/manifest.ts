import type { MetadataRoute } from 'next';
import { DEFAULT_PLATFORM_NAME } from '../platform';

export interface PwaIcons {
  any192: string;
  any512: string;
  maskable512: string;
}

/** Everything the client may change in site settings (M25-S01 AC2). */
export interface PwaSettings {
  name: string;
  tagline: string;
  themeColor: string;
  backgroundColor: string;
  icons: PwaIcons;
}

/**
 * Fallbacks used until site settings supply values. The colours mirror the default theme tokens
 * (`--color-primary`, `--color-bg`) because a manifest cannot read CSS variables.
 */
export const DEFAULT_PWA_SETTINGS: PwaSettings = {
  name: DEFAULT_PLATFORM_NAME,
  tagline: 'Free learning videos for everyone.',
  themeColor: '#1F6FB5',
  backgroundColor: '#F5F5F2',
  icons: {
    any192: '/icons/icon-192.png',
    any512: '/icons/icon-512.png',
    maskable512: '/icons/icon-maskable-512.png',
  },
};

const HEX = /^#[0-9A-Fa-f]{6}$/;
const MAX_SHORT_NAME = 12;

/** Home screen labels are cut off after about 12 characters, so use the first word when the name is long. */
export function shortNameOf(name: string): string {
  if (name.length <= MAX_SHORT_NAME) return name;
  const first = name.split(/\s+/)[0] ?? name;
  return first.slice(0, MAX_SHORT_NAME);
}

export function buildManifest(settings: PwaSettings): MetadataRoute.Manifest {
  const color = (value: string, fallback: string) => (HEX.test(value) ? value : fallback);
  return {
    id: '/',
    name: settings.name,
    short_name: shortNameOf(settings.name),
    description: settings.tagline,
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    lang: 'en',
    categories: ['education', 'entertainment'],
    theme_color: color(settings.themeColor, DEFAULT_PWA_SETTINGS.themeColor),
    background_color: color(settings.backgroundColor, DEFAULT_PWA_SETTINGS.backgroundColor),
    icons: [
      { src: settings.icons.any192, sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: settings.icons.any512, sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: settings.icons.maskable512, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
