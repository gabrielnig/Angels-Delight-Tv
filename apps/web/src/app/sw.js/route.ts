import { loadWebEnv } from '@ad/config';
import { buildServiceWorkerSource } from '../../lib/pwa/sw-source';
import { SW_PRECACHE, OFFLINE_URL } from '../../lib/pwa/constants';

export const dynamic = 'force-dynamic';

/**
 * Serves the service worker from the site root so its scope is the whole site. It is never cached by the
 * browser, so a new build or the kill switch (PWA_ENABLED=false) takes effect on the next check.
 */
export async function GET(): Promise<Response> {
  const env = loadWebEnv();
  const mediaBase = env.MEDIA_ORIGIN.replace(/\/+$/, '');
  const source = buildServiceWorkerSource({
    enabled: env.PWA_ENABLED,
    version: env.APP_VERSION,
    offlineUrl: OFFLINE_URL,
    precache: SW_PRECACHE,
    imageBases: [mediaBase],
  });
  return new Response(source, {
    headers: {
      'Content-Type': 'text/javascript; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Service-Worker-Allowed': '/',
    },
  });
}
