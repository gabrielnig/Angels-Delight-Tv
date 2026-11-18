import { handle, type EdgeCache, type EdgeEnv } from './handler';

/**
 * Only the default handler may be exported from a Workers entry. workerd refuses to start when a module exports
 * a constant or a helper (found by running this file in miniflare), so everything else stays in ./handler.
 */
declare const caches: { default: EdgeCache };

export default {
  async fetch(
    request: Request,
    env: EdgeEnv,
    ctx: { waitUntil(promise: Promise<unknown>): void },
  ): Promise<Response> {
    const cache = caches.default;
    return handle(request, env, {
      cache: {
        match: (r) => cache.match(r),
        put: async (r, response) => void ctx.waitUntil(cache.put(r, response)),
      },
    });
  },
};
