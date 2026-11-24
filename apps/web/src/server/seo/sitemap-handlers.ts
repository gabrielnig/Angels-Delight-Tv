import { buildSitemapEntries, chunkEntries, type SitemapRows } from '../../lib/seo/sitemap';
import { renderIndexXml, renderUrlsetXml } from '../../lib/seo/sitemap-xml';

export interface SitemapDeps {
  load(): Promise<SitemapRows>;
  origin(): string | undefined;
}

const HEADERS = {
  'content-type': 'application/xml; charset=utf-8',
  'cache-control': 'public, s-maxage=3600, stale-while-revalidate=600',
};

/** A failed build must never look like an empty site: crawlers back off on 503 and keep the old list. */
function unavailable(): Response {
  return new Response('Sitemap is temporarily unavailable', {
    status: 503,
    headers: {
      'retry-after': '300',
      'cache-control': 'no-store',
      'content-type': 'text/plain; charset=utf-8',
    },
  });
}

async function build(deps: SitemapDeps) {
  const origin = deps.origin()?.replace(/\/+$/, '');
  if (!origin) throw new Error('APP_ORIGIN is not set');
  return { origin, chunks: chunkEntries(buildSitemapEntries(origin, await deps.load())) };
}

/**
 * `/sitemap.xml` is a plain urlset while everything fits in one file and an index of `/sitemaps/<n>.xml` files
 * beyond that (M45-S01, D-L6-4). Route handlers rather than the metadata file convention, because only a handler
 * can answer 503 with Retry-After when the catalog query fails.
 */
export function createSitemapHandlers(deps: SitemapDeps) {
  return {
    async index(_request: Request): Promise<Response> {
      try {
        const { origin, chunks } = await build(deps);
        if (chunks.length === 1)
          return new Response(renderUrlsetXml(chunks[0]!), { headers: HEADERS });
        const files = chunks.map((_, i) => `${origin}/sitemaps/${i + 1}.xml`);
        return new Response(renderIndexXml(files), { headers: HEADERS });
      } catch {
        return unavailable();
      }
    },
    async chunk(_request: Request, id: string): Promise<Response> {
      const match = /^([1-9][0-9]{0,5})\.xml$/.exec(id);
      if (!match) return new Response('Not found', { status: 404 });
      try {
        const { chunks } = await build(deps);
        const part = chunks[Number(match[1]) - 1];
        if (!part) return new Response('Not found', { status: 404 });
        return new Response(renderUrlsetXml(part), { headers: HEADERS });
      } catch {
        return unavailable();
      }
    },
  };
}
