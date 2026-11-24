import 'server-only';
import { msg } from '@ad/shared/messages';
import { getCatalog } from '../../lib/data';
import { getRootTheme } from '../../lib/theme/root';
import { getSeoSettings } from './seo-settings';
import { createOgHandler } from './og-handler';
import { renderOgJpeg } from './og-render';

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

export const ogHandler = createOgHandler({
  preview: (slug, kind) => getCatalog().publicPreview(slug, kind),
  siteName: async () => (await getRootTheme()).platformName,
  freeLine: () => msg('og.freeToWatch'),
  defaultImageUrl: async () => (await getSeoSettings()).socialImageUrl,
  fetchPoster,
  render: renderOgJpeg,
});
