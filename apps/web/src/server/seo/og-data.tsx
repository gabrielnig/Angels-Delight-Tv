import 'server-only';
import { msg } from '@ad/shared/messages';
import { getCatalog } from '../../lib/data';
import { getRootTheme } from '../../lib/theme/root';
import { titleIndexable } from './page-seo';
import { getSeoSettings } from './seo-settings';
import { createOgHandler } from './og-handler';
import { renderDefaultCard, renderOgJpeg } from './og-render';

/** Posters live on the media origin we control, so a plain fetch with a short timeout is enough. */
async function fetchPoster(url: string): Promise<Buffer | null> {
  try {
    const origin = process.env.APP_ORIGIN ?? 'http://localhost:3000';
    const res = await fetch(new URL(url, origin), { signal: AbortSignal.timeout(5000) });
    return res.ok ? Buffer.from(await res.arrayBuffer()) : null;
  } catch {
    return null;
  }
}

let defaultKept: { key: string; bytes: Buffer } | null = null;

/** The generic platform card, made once per site name, theme colour and default image link. */
async function defaultCard(): Promise<Buffer> {
  const [theme, seo] = await Promise.all([getRootTheme(), getSeoSettings()]);
  const accent = theme.injection.themeColor;
  const key = [theme.platformName, accent, seo.socialImageUrl].join('|');
  if (defaultKept?.key === key) return defaultKept.bytes;
  const bytes = await renderDefaultCard({
    siteName: theme.platformName,
    accent,
    image: await fetchPoster(seo.socialImageUrl),
  });
  defaultKept = { key, bytes };
  return bytes;
}

export const ogHandler = createOgHandler({
  preview: (slug, kind) => getCatalog().publicPreview(slug, kind),
  siteName: async () => (await getRootTheme()).platformName,
  freeLine: () => msg('og.freeToWatch'),
  options: async () => {
    const [theme, seo] = await Promise.all([getRootTheme(), getSeoSettings()]);
    return { overlay: seo.titleOverlay, badge: seo.playBadge, accent: theme.injection.themeColor };
  },
  defaultCard,
  indexable: (slug, kind) => titleIndexable(kind, slug),
  fetchPoster,
  render: renderOgJpeg,
});
