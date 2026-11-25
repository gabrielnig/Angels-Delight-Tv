import type { PublicPreview } from '../../lib/data/types';
import { pickPosterUrl } from '../../lib/seo/og-image';
import type { OgRenderInput } from './og-render';

export interface OgOptions {
  /** Draw the title and site name over the picture (setting seo.share_title_overlay). */
  overlay: boolean;
  /** Draw a play badge on video pictures (setting seo.share_play_badge). */
  badge: boolean;
  /** Card colour behind a missing poster, from the site theme. */
  accent: string;
}

export interface OgDeps {
  preview(slug: string, kind: 'video' | 'series'): Promise<PublicPreview | null>;
  siteName(): Promise<string>;
  freeLine(): string;
  options(): Promise<OgOptions>;
  /** The generic platform card as a 1200 by 630 jpeg under 300 KB. Throws when it cannot be made. */
  defaultCard(): Promise<Buffer>;
  /** False for a kids only title (R26). Optional so callers that do not care keep working. */
  indexable?(slug: string, kind: 'video' | 'series'): Promise<boolean>;
  fetchPoster(url: string): Promise<Buffer | null>;
  render(input: OgRenderInput): Promise<Buffer>;
}

const VERSIONED = 'public, max-age=31536000, immutable';
const UNVERSIONED = 'public, max-age=86400, stale-while-revalidate=604800';
const SHORT = 'public, max-age=300';
const STORE_LIMIT = 300;

function image(bytes: Buffer, cacheControl: string, extra: Record<string, string> = {}): Response {
  return new Response(new Uint8Array(bytes), {
    headers: {
      'content-type': 'image/jpeg',
      'content-length': String(bytes.length),
      'cache-control': cacheControl,
      ...extra,
    },
  });
}

/**
 * Share picture for a title or series (M45-S03, L15b). Chain: the generated card from the poster, then the
 * generic platform card. It always answers 200 with image bytes (chat apps do not follow redirects on og:image),
 * except for titles a visitor may not see, which answer 404. A kids only title gets the generic card and noindex,
 * never its own title or poster. Finished cards are kept per slug and version, so a crawl burst renders once.
 */
export function createOgHandler(deps: OgDeps) {
  const store = new Map<string, Buffer>();
  const remember = (key: string, bytes: Buffer) => {
    store.delete(key);
    store.set(key, bytes);
    while (store.size > STORE_LIMIT) store.delete(store.keys().next().value as string);
  };

  return async (request: Request, kind: 'video' | 'series', slug: string): Promise<Response> => {
    const found = await deps.preview(slug, kind);
    if (!found || found.type === 'redirect' || found.type !== kind) {
      return new Response('Not found', { status: 404 });
    }
    const listed = deps.indexable ? await deps.indexable(slug, kind).catch(() => false) : true;
    const robots: Record<string, string> = listed ? {} : { 'x-robots-tag': 'noindex' };
    const generic = async (): Promise<Response> => {
      try {
        return image(await deps.defaultCard(), SHORT, robots);
      } catch {
        return new Response('Not found', { status: 404 });
      }
    };
    if (!listed) return generic();

    const version = new URL(request.url).searchParams.get('v') ?? '';
    const key = `${kind}:${slug}:${version}`;
    const kept = version ? store.get(key) : undefined;
    if (kept) return image(kept, VERSIONED, robots);

    const posterUrl = pickPosterUrl(found.item.thumbnail);
    if (!posterUrl) return generic();
    try {
      const [options, siteName, poster] = await Promise.all([
        deps.options(),
        deps.siteName(),
        deps.fetchPoster(posterUrl),
      ]);
      const jpeg = await deps.render({
        kind,
        title: found.item.title,
        siteName,
        freeLine: deps.freeLine(),
        poster,
        ...options,
      });
      // Without its poster the card is a stand in: do not keep it or let caches hold it for a year.
      if (!poster) return image(jpeg, SHORT, robots);
      if (version) remember(key, jpeg);
      return image(jpeg, version ? VERSIONED : UNVERSIONED, robots);
    } catch {
      return generic();
    }
  };
}
