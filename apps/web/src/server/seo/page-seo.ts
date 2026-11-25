import 'server-only';
import { isKidsOnlyTitle } from '@ad/catalog';
import { getServices } from '../../lib/runtime/services';
import { realDataEnabled } from '../data/mode';
import { buildShareConfig } from '../../components/share/share-config';
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

/** What the Share sheet lists and says: the admin's channels, the text, and the clean canonical link (D-391). */
export async function shareConfig(
  title: string,
  kind: 'video' | 'series',
  slug: string,
  thumbnail?: string,
) {
  return buildShareConfig({
    seo: await getSeoSettings(),
    title,
    kind,
    slug,
    origin: siteOrigin(),
    thumbnail,
  });
}
