import type { PublicPreview } from '../../lib/data/types';
import { pickPosterUrl } from '../../lib/seo/og-image';
import type { OgRenderInput } from './og-render';

export interface OgDeps {
  preview(slug: string, kind: 'video' | 'series'): Promise<PublicPreview | null>;
  siteName(): Promise<string>;
  freeLine(): string;
  defaultImageUrl(): Promise<string>;
  fetchPoster(url: string): Promise<Buffer | null>;
  render(input: OgRenderInput): Promise<Buffer>;
}

const CACHE = 'public, max-age=86400, stale-while-revalidate=604800';

/**
 * Share picture for a title or series (M45-S03). Unpublished titles answer 404 so previews never leak drafts.
 * No poster, or a failed render, sends crawlers to the site default image with a short cache.
 */
export function createOgHandler(deps: OgDeps) {
  return async (request: Request, kind: 'video' | 'series', slug: string): Promise<Response> => {
    const found = await deps.preview(slug, kind);
    if (!found || found.type === 'redirect' || found.type !== kind) {
      return new Response('Not found', { status: 404 });
    }
    const fallback = async () =>
      new Response(null, {
        status: 302,
        headers: {
          location: new URL(await deps.defaultImageUrl(), request.url).toString(),
          'cache-control': 'public, max-age=300',
        },
      });
    const posterUrl = pickPosterUrl(found.item.thumbnail);
    if (!posterUrl) return fallback();
    try {
      const jpeg = await deps.render({
        title: found.item.title,
        siteName: await deps.siteName(),
        freeLine: deps.freeLine(),
        poster: await deps.fetchPoster(posterUrl),
      });
      return new Response(new Uint8Array(jpeg), {
        headers: { 'content-type': 'image/jpeg', 'cache-control': CACHE },
      });
    } catch {
      return fallback();
    }
  };
}
