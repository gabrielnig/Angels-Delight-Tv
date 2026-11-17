import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
import { buildServiceWorkerSource, type ServiceWorkerConfig } from './sw-source';

type Handler = (event: Record<string, unknown>) => void;

const keyOf = (request: { url: string } | string) =>
  new URL(typeof request === 'string' ? request : request.url, 'https://tv.example').href;

class FakeCache {
  entries = new Map<string, unknown>();
  async match(request: { url: string } | string) {
    return this.entries.get(keyOf(request));
  }
  async put(request: { url: string } | string, response: unknown) {
    this.entries.set(keyOf(request), response);
  }
  async add(url: string) {
    this.entries.set(keyOf(url), { ok: true, url: keyOf(url) });
  }
  async delete(request: { url: string } | string) {
    return this.entries.delete(keyOf(request));
  }
  async keys() {
    return [...this.entries.keys()].map((url) => ({ url }));
  }
}

function boot(overrides: Partial<ServiceWorkerConfig> = {}) {
  const handlers = new Map<string, Handler>();
  const stores = new Map<string, FakeCache>();
  const network: string[] = [];
  let networkDown = false;
  let responder: (url: string) => { status?: number; type?: string; cache?: string } = () => ({});
  let skipped = false;
  let unregistered = false;
  let claimed = false;
  const respond = (url: string, init: { status?: number; type?: string; cache?: string } = {}) => ({
    ok: (init.status ?? 200) < 400,
    status: init.status ?? 200,
    type: init.type ?? 'basic',
    url,
    headers: new Headers(init.cache ? { 'cache-control': init.cache } : {}),
    clone() {
      return this;
    },
  });
  const sandbox = {
    self: {
      addEventListener: (type: string, fn: Handler) => handlers.set(type, fn),
      skipWaiting: async () => {
        skipped = true;
      },
      clients: {
        claim: async () => {
          claimed = true;
        },
      },
      registration: {
        unregister: async () => {
          unregistered = true;
        },
      },
      location: { origin: 'https://tv.example' },
    },
    caches: {
      open: async (name: string) => {
        if (!stores.has(name)) stores.set(name, new FakeCache());
        return stores.get(name)!;
      },
      keys: async () => [...stores.keys()],
      delete: async (name: string) => stores.delete(name),
      match: async (request: { url: string } | string) => {
        for (const store of stores.values()) {
          const hit = await store.match(request);
          if (hit) return hit;
        }
        return undefined;
      },
    },
    fetch: async (request: { url: string }) => {
      network.push(request.url);
      if (networkDown) throw new TypeError('offline');
      return respond(request.url, responder(request.url));
    },
    URL,
    Headers,
    Promise,
    console,
  };
  const config: ServiceWorkerConfig = {
    enabled: true,
    version: 'v1',
    offlineUrl: '/offline',
    precache: ['/offline', '/manifest.webmanifest', '/icons/icon-192.png'],
    imageBases: ['https://media.example/ad-media'],
    ...overrides,
  };
  runInNewContext(buildServiceWorkerSource(config), sandbox);

  const waitable = () => {
    let promise: Promise<unknown> = Promise.resolve();
    return { waitUntil: (p: Promise<unknown>) => void (promise = p), done: () => promise };
  };
  const lifecycle = async (type: 'install' | 'activate') => {
    const event = waitable();
    handlers.get(type)!(event);
    await event.done();
  };
  const fetchEvent = async (
    url: string,
    init: { method?: string; mode?: string; headers?: Record<string, string> } = {},
  ) => {
    let result: Promise<unknown> | undefined;
    const request = {
      url: new URL(url, 'https://tv.example').href,
      method: init.method ?? 'GET',
      mode: init.mode ?? 'no-cors',
      headers: new Headers(init.headers),
    };
    handlers.get('fetch')?.({
      request,
      respondWith: (p: Promise<unknown>) => (result = Promise.resolve(p)),
    });
    return {
      handled: result !== undefined,
      response: result ? ((await result) as { url?: string; ok?: boolean }) : undefined,
      request,
    };
  };
  return {
    handlers,
    stores,
    network,
    lifecycle,
    fetchEvent,
    setDown: (down: boolean) => (networkDown = down),
    setResponder: (fn: typeof responder) => (responder = fn),
    flags: () => ({ skipped, unregistered, claimed }),
    message: (data: unknown) => handlers.get('message')?.({ data }),
  };
}

describe('service worker policy', () => {
  it('precaches the offline page and shell files on install', async () => {
    const sw = boot();
    await sw.lifecycle('install');
    const keys = await sw.stores.get('ad-static-v1')!.keys();
    expect(keys.map((k) => new URL(k.url).pathname).sort()).toEqual([
      '/icons/icon-192.png',
      '/manifest.webmanifest',
      '/offline',
    ]);
  });

  it('removes caches from older versions on activate and claims clients', async () => {
    const sw = boot();
    await sw.lifecycle('install');
    await sw.stores.set('ad-static-v0', new FakeCache());
    await sw.lifecycle('activate');
    expect([...sw.stores.keys()]).toEqual(['ad-static-v1']);
    expect(sw.flags().claimed).toBe(true);
  });

  it('does not take over until told to, so an update never lands mid-playback', async () => {
    const sw = boot();
    await sw.lifecycle('install');
    expect(sw.flags().skipped).toBe(false);
    sw.message({ type: 'SKIP_WAITING' });
    expect(sw.flags().skipped).toBe(true);
  });

  it('serves hashed static assets cache first and stores them after one fetch', async () => {
    const sw = boot();
    await sw.lifecycle('install');
    const url = '/_next/static/chunks/app-abc123.js';
    expect((await sw.fetchEvent(url)).handled).toBe(true);
    expect(sw.network).toHaveLength(1);
    await sw.fetchEvent(url);
    expect(sw.network).toHaveLength(1);
  });

  it('never touches video segments, playlists, keys or captions', async () => {
    const sw = boot();
    for (const path of [
      '/v/abc/360/seg_00001.ts',
      '/v/abc/master.m3u8',
      '/clip.mp4',
      '/seg.m4s',
      '/api/playback/key',
      '/x.vtt',
    ]) {
      expect((await sw.fetchEvent(path)).handled).toBe(false);
    }
    expect((await sw.fetchEvent('https://media.example/ad-media/v/abc/360/seg_1.ts')).handled).toBe(
      false,
    );
  });

  it('never caches API responses, admin pages or authenticated requests', async () => {
    const sw = boot();
    expect((await sw.fetchEvent('/api/me')).handled).toBe(false);
    expect((await sw.fetchEvent('/admin/videos')).handled).toBe(false);
    expect(
      (await sw.fetchEvent('/_next/static/a.js', { headers: { authorization: 'Bearer x' } }))
        .handled,
    ).toBe(false);
    expect((await sw.fetchEvent('/_next/static/a.js', { method: 'POST' })).handled).toBe(false);
    expect(
      (await sw.fetchEvent('/_next/static/a.js', { headers: { range: 'bytes=0-1' } })).handled,
    ).toBe(false);
  });

  it('does not store failed or no-store responses', async () => {
    const sw = boot();
    await sw.lifecycle('install');
    sw.setResponder((url) =>
      url.endsWith('/bad.js')
        ? { status: 500 }
        : url.endsWith('/private.js')
          ? { cache: 'no-store' }
          : {},
    );
    await sw.fetchEvent('/_next/static/bad.js');
    await sw.fetchEvent('/_next/static/private.js');
    await sw.fetchEvent('/_next/static/good.js');
    const store = sw.stores.get('ad-static-v1')!;
    expect(await store.match('/_next/static/bad.js')).toBeUndefined();
    expect(await store.match('/_next/static/private.js')).toBeUndefined();
    expect(await store.match('/_next/static/good.js')).toBeDefined();
  });

  it('shows the offline page when a navigation fails and never caches page html', async () => {
    const sw = boot();
    await sw.lifecycle('install');
    const online = await sw.fetchEvent('/browse', { mode: 'navigate' });
    expect(online.handled).toBe(true);
    const store = sw.stores.get('ad-static-v1')!;
    expect(await store.match({ url: 'https://tv.example/browse' })).toBeUndefined();
    sw.setDown(true);
    const offline = await sw.fetchEvent('/browse', { mode: 'navigate' });
    expect(new URL(offline.response!.url!).pathname).toBe('/offline');
  });

  it('caches posters from the media origin images path and trims nothing else', async () => {
    const sw = boot();
    await sw.lifecycle('install');
    const poster = 'https://media.example/ad-media/img/abc/320-aa.webp';
    expect((await sw.fetchEvent(poster)).handled).toBe(true);
    await sw.fetchEvent(poster);
    expect(sw.network.filter((u) => u === poster)).toHaveLength(1);
    expect((await sw.fetchEvent('https://evil.example/img/a.webp')).handled).toBe(false);
    expect((await sw.fetchEvent('https://media.example/other/img/a.webp')).handled).toBe(false);
    expect((await sw.fetchEvent('https://media.example/ad-media/cap/x/en/a.vtt')).handled).toBe(
      false,
    );
  });

  it('with the kill switch on, it removes every cache, unregisters and handles no requests', async () => {
    const sw = boot({ enabled: false });
    await sw.lifecycle('install');
    await sw.stores.set('ad-static-v1', new FakeCache());
    await sw.lifecycle('activate');
    expect(sw.stores.size).toBe(0);
    expect(sw.flags().unregistered).toBe(true);
    expect((await sw.fetchEvent('/_next/static/a.js')).handled).toBe(false);
  });

  it('can be told to clear every cache, for sign out', async () => {
    const sw = boot();
    await sw.lifecycle('install');
    sw.message({ type: 'CLEAR_CACHES' });
    await new Promise((r) => setTimeout(r, 0));
    expect(sw.stores.size).toBe(0);
  });
});
