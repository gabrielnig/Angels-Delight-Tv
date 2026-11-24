import type { PublicPreview } from '../../lib/data/types';
import { pickPosterUrl } from '../../lib/seo/og-image';
import type { OgRenderInput } from './og-render';

export interface OgDeps {
  preview(slug: string, kind: 'video' | 'series'): Promise<PublicPreview | null>;
  siteName(): Promise<string>;
  freeLine(): string;
  defaultImageUrl(): Promise<string>;
  /** False for a kids only title (R26). Optional so callers that do not care keep working. */
  indexable?(slug: string, kind: 'video' | 'series'): Promise<boolean>;
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
    // A failed lookup keeps the picture out of the index rather than risk listing it.
    const listed = deps.indexable ? await deps.indexable(slug, kind).catch(() => false) : true;
    const robots: Record<string, string> = listed ? {} : { 'x-robots-tag': 'noindex' };
    const fallback = async () =>
      new Response(null, {
        status: 302,
        headers: {
          location: new URL(await deps.defaultImageUrl(), request.url).toString(),
          'cache-control': 'public, max-age=300',
          ...robots,
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
        headers: { 'content-type': 'image/jpeg', 'cache-control': CACHE, ...robots },
      });
    } catch {
      return fallback();
    }
  };
}
