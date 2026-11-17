import { handle, type EdgeCache, type EdgeEnv } from './handler';

export * from './handler';

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
