export interface ServiceWorkerConfig {
  /** Kill switch (M25-S02 Error). When false the worker removes every cache and unregisters itself. */
  enabled: boolean;
  /** Build id. Changing it makes a new worker and a new static cache name. */
  version: string;
  offlineUrl: string;
  /** Small files fetched on install: the offline page, the manifest, icons. */
  precache: string[];
  /** Media bases (origin plus any path prefix, no trailing slash). Posters under `<base>/img/` are cached, nothing else cross origin. */
  imageBases: string[];
  /** Public pages kept after a visit so the offline screen can link to them (M25-S04). Exact paths. */
  savedPages?: string[];
}

/**
 * The service worker script, as text, so one route can serve it with the version and switch baked in and
 * the policy can be tested by running the exact shipped code in a sandbox.
 *
 * Policy, written so the safe answer is the default (anything not listed is left to the network):
 * - cached: hashed build files under /_next/static (cache first), our icons and fonts, public posters from the
 *   media origin (cache first, bounded).
 * - never cached: non GET, Range or Authorization requests, /api, /admin, video playlists, segments, keys and
 *   captions, anything from another origin except posters, responses that failed or say no-store.
 * - page navigations go to the network. Page HTML is never stored (it is personal), except the few public
 *   pages named in `savedPages` (D-143), which the offline screen links to. A failed navigation falls back to
 *   the saved copy or the precached offline page. CLEAR_CACHES removes every copy on sign out or profile switch.
 */
export function buildServiceWorkerSource(config: ServiceWorkerConfig): string {
  if (!config.enabled) return KILL_SWITCH_SOURCE;
  const settings = JSON.stringify({
    version: config.version,
    offlineUrl: config.offlineUrl,
    precache: config.precache,
    imageBases: config.imageBases,
    savedPages: config.savedPages ?? [],
  });
  return `'use strict';
var CONFIG = ${settings};
var STATIC_CACHE = 'ad-static-' + CONFIG.version;
var IMAGE_CACHE = 'ad-img-v1';
var PAGE_CACHE = 'ad-pages-v1';
var IMAGE_MAX_ENTRIES = 120;
var MEDIA_FILE = /\\.(m3u8|ts|m4s|mp4|m4a|webm|key|vtt|srt)$/i;

function decide(request) {
  if (request.method !== 'GET') return 'bypass';
  if (request.headers.has('range') || request.headers.has('authorization')) return 'bypass';
  var url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    var isPoster = CONFIG.imageBases.some(function (base) { return request.url.indexOf(base + '/img/') === 0; });
    return isPoster && !MEDIA_FILE.test(url.pathname) ? 'image' : 'bypass';
  }
  var path = url.pathname;
  if (path.indexOf('/api/') === 0 || path === '/api' || path.indexOf('/s/') === 0 || path.indexOf('/admin') === 0 || path.indexOf('/v/') === 0) return 'bypass';
  if (MEDIA_FILE.test(path)) return 'bypass';
  if (request.mode === 'navigate') return 'navigate';
  if (path.indexOf('/_next/static/') === 0 || path.indexOf('/icons/') === 0 || path.indexOf('/brand-icons/') === 0 || path.indexOf('/fonts/') === 0) return 'static';
  return 'bypass';
}

function storable(response) {
  if (!response || !response.ok || response.status !== 200) return false;
  if (response.type !== 'basic' && response.type !== 'cors') return false;
  var control = response.headers.get('cache-control') || '';
  return !/no-store|private/i.test(control);
}

async function cacheFirst(request, cacheName, limit) {
  var cache = await caches.open(cacheName);
  var hit = await cache.match(request);
  if (hit) return hit;
  var response = await fetch(request);
  if (storable(response)) {
    await cache.put(request, response.clone());
    if (limit) await trim(cache, limit);
  }
  return response;
}

async function trim(cache, limit) {
  var keys = await cache.keys();
  for (var i = 0; i < keys.length - limit; i++) await cache.delete(keys[i]);
}

async function savedPage(request) {
  var cache = await caches.open(PAGE_CACHE);
  try {
    var response = await fetch(request);
    if (storable(response)) await cache.put(request, response.clone());
    return response;
  } catch (error) {
    var hit = await cache.match(request);
    if (hit) return hit;
    var page = await caches.match(CONFIG.offlineUrl);
    return page || new Response('You are offline', { status: 503, headers: { 'content-type': 'text/plain' } });
  }
}

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(function (cache) {
      return Promise.all(CONFIG.precache.map(function (url) { return cache.add(url).catch(function () {}); }));
    })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (names) {
      return Promise.all(names.filter(function (name) {
        return name.indexOf('ad-static-') === 0 && name !== STATIC_CACHE;
      }).map(function (name) { return caches.delete(name); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('message', function (event) {
  var type = event.data && event.data.type;
  if (type === 'SKIP_WAITING') self.skipWaiting();
  if (type === 'CLEAR_CACHES') {
    caches.keys().then(function (names) { return Promise.all(names.map(function (name) { return caches.delete(name); })); });
  }
});

self.addEventListener('fetch', function (event) {
  var kind = decide(event.request);
  if (kind === 'bypass') return;
  if (kind === 'static') {
    event.respondWith(cacheFirst(event.request, STATIC_CACHE, 0));
  } else if (kind === 'image') {
    event.respondWith(cacheFirst(event.request, IMAGE_CACHE, IMAGE_MAX_ENTRIES));
  } else if (CONFIG.savedPages.indexOf(new URL(event.request.url).pathname) !== -1) {
    event.respondWith(savedPage(event.request));
  } else {
    event.respondWith(
      fetch(event.request).catch(function () {
        return caches.match(CONFIG.offlineUrl).then(function (page) {
          return page || new Response('You are offline', { status: 503, headers: { 'content-type': 'text/plain' } });
        });
      })
    );
  }
});
`;
}

/** Installs, wipes every cache, unregisters, and handles no requests. */
const KILL_SWITCH_SOURCE = `'use strict';
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys()
      .then(function (names) { return Promise.all(names.map(function (name) { return caches.delete(name); })); })
      .then(function () { return self.registration.unregister(); })
  );
});
`;
