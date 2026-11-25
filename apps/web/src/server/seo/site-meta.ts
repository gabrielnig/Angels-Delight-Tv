import 'server-only';
import type { Metadata } from 'next';
import { localeInfo } from '@ad/shared/messages';
import { getLocale, currentEnabledLocales } from '../../lib/i18n/server';
import { getRootTheme } from '../../lib/theme/root';
import { buildMetadata, ogLocale, type PageMeta, type ShareImageMeta, type SiteMeta } from '../../lib/seo/metadata';
import { getSeoSettings } from './seo-settings';

const TYPES: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif' };

/** Mime type from the file extension of a link, jpeg when it cannot be told. */
export function imageTypeOf(url: string): string {
  const ext = /\.([a-z0-9]+)(?:$|[?#])/i.exec(url)?.[1]?.toLowerCase() ?? '';
  return TYPES[ext] ?? 'image/jpeg';
}

/** The platform default card: the admin link, else the bundled placeholder. 1200 by 630 is what the settings text asks for. */
export function defaultShareImage(url: string, alt?: string): ShareImageMeta {
  return { url, width: 1200, height: 630, type: imageTypeOf(url), ...(alt ? { alt } : {}) };
}

/** Everything the metadata builder needs from settings and the current language. Never throws (settings reads fall back). */
export async function getSiteMeta(): Promise<SiteMeta> {
  const [{ platformName }, seo, locale] = await Promise.all([getRootTheme(), getSeoSettings(), getLocale()]);
  const htmlLang = (code: string) => localeInfo(code as never)?.htmlLang ?? 'en-NG';
  const current = ogLocale(htmlLang(locale));
  const alternates = [...new Set(currentEnabledLocales().map((code) => ogLocale(htmlLang(code))))].filter((l) => l !== current);
  return {
    siteName: platformName,
    description: seo.description,
    defaultImage: defaultShareImage(seo.socialImageUrl, platformName),
    twitterHandle: seo.twitterHandle,
    locale: current,
    alternateLocales: alternates,
    indexing: seo.indexing,
  };
}

/** Metadata for any public route: one call, same tags everywhere. */
export async function pageMetadata(page: PageMeta): Promise<Metadata> {
  return buildMetadata(await getSiteMeta(), page);
}

/** Settings that change the drawn picture. They go into the image version so a change makes chat apps fetch it again. */
export async function shareImageExtra(): Promise<string[]> {
  const [theme, seo] = await Promise.all([getRootTheme(), getSeoSettings()]);
  return [theme.platformName, theme.injection.themeColor, String(seo.titleOverlay), String(seo.playBadge)];
}
