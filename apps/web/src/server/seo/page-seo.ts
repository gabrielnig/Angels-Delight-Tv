import 'server-only';
import { isKidsOnlyTitle } from '@ad/catalog';
import { getServices } from '../../lib/runtime/services';
import { realDataEnabled } from '../data/mode';
import { shareText } from '../../lib/site/seo-settings';
import { getSeoSettings } from './seo-settings';

/** The public origin, the only source for canonical, sitemap and structured data urls. */
export function siteOrigin(): string | undefined {
  const origin = process.env.APP_ORIGIN?.replace(/\/+$/, '');
  return origin || undefined;
}

/**
 * False for a kids only title, which search engines are asked to skip (R26). Fixture mode has no database and
 * indexes nothing special. A failed lookup keeps the title out of the index rather than risk listing it.
 */
export async function titleIndexable(kind: 'video' | 'series', slug: string): Promise<boolean> {
  if (!realDataEnabled()) return true;
  try {
    return !(await isKidsOnlyTitle(getServices().db, kind, slug));
  } catch {
    return false;
  }
}

/** What the Share menu lists and says: the admin's channels and text with this title filled in. */
export async function shareConfig(title: string) {
  const seo = await getSeoSettings();
  return {
    channels: seo.shareChannels,
    text: shareText(seo.shareTemplate, { title, siteName: seo.platformName }),
  };
}
