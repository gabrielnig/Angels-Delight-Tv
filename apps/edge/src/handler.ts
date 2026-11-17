/**
 * Pure request handler for the media worker. It uses only WebCrypto and web standard types, so it runs in
 * Cloudflare Workers and in Node tests. Signature scheme: sig = base64url(HMAC_SHA256(secret, key + "\n" + exp)).
 */

export interface EdgeBody {
  body: ReadableStream | null;
  size: number;
  httpEtag?: string;
  /** Present when the read was ranged. */
  range?: { offset: number; length: number };
}

export interface EdgeBucket {
  get(
    key: string,
    options?: { range?: { offset: number; length: number } },
  ): Promise<EdgeBody | null>;
  head(key: string): Promise<{ size: number; httpEtag?: string } | null>;
}

export interface EdgeCache {
  match(request: Request): Promise<Response | undefined>;
  put(request: Request, response: Response): Promise<void>;
}

export interface EdgeEnv {
  MEDIA: EdgeBucket;
  /** Base64 of the 32 byte media url secret. */
  MEDIA_URL_SECRET: string;
  MEDIA_URL_SECRET_PREVIOUS?: string;
  APP_ORIGIN: string;
}

export const SKEW_SECONDS = 30;
const SEGMENT_CACHE = 'public, max-age=31536000, immutable';
const KEY_PATTERN = /^(v|cap|img)\/[A-Za-z0-9_.-]+(\/[A-Za-z0-9_.-]+)*$/;

function fromBase64(value: string): Uint8Array {
  const bin = atob(value);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

function toBase64Url(bytes: ArrayBuffer): string {
  let bin = '';
  for (const b of new Uint8Array(bytes)) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function sign(secret: Uint8Array, key: string, exp: number): Promise<string> {
  const material = await crypto.subtle.importKey(
    'raw',
    secret as unknown as ArrayBuffer,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const mac = await crypto.subtle.sign('HMAC', material, new TextEncoder().encode(`${key}\n${exp}`));
  return toBase64Url(mac);
}

function equal(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function authorized(env: EdgeEnv, key: string, url: URL, now: number): Promise<boolean> {
  const expRaw = url.searchParams.get('exp') ?? '';
  const sig = url.searchParams.get('sig') ?? '';
  if (!/^\d{1,12}$/.test(expRaw) || sig === '') return false;
  const exp = Number(expRaw);
  if (now > exp + SKEW_SECONDS) return false;
  for (const secret of [env.MEDIA_URL_SECRET, env.MEDIA_URL_SECRET_PREVIOUS]) {
    if (!secret) continue;
    if (equal(await sign(fromBase64(secret), key, exp), sig)) return true;
  }
  return false;
}

function contentType(key: string): string {
  if (key.endsWith('.ts')) return 'video/mp2t';
  if (key.endsWith('.vtt')) return 'text/vtt; charset=utf-8';
  if (key.endsWith('.webp')) return 'image/webp';
  return 'application/octet-stream';
}

function plain(status: number, message: string, extra: Record<string, string> = {}): Response {
  return new Response(message, {
    status,
    headers: { 'content-type': 'text/plain', 'cache-control': 'no-store', ...extra },
  });
}

function parseRange(header: string | null, size: number) {
  if (!header) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(header);
  if (!m || (!m[1] && !m[2])) return 'invalid' as const;
  let start = m[1] ? Number(m[1]) : size - Number(m[2]);
  let end = m[1] && m[2] ? Number(m[2]) : size - 1;
  start = Math.max(start, 0);
  end = Math.min(end, size - 1);
  if (start > end) return 'invalid' as const;
  return { offset: start, length: end - start + 1 };
}

export interface HandleOptions {
  cache?: EdgeCache;
  now?: () => number;
}

/** The cache key drops `exp` and `sig` so one cached segment serves every signed url for it. */
export function cacheKeyFor(url: URL): Request {
  const clean = new URL(url.toString());
  clean.search = '';
  return new Request(clean.toString(), { method: 'GET' });
}

export async function handle(
  request: Request,
  env: EdgeEnv,
  options: HandleOptions = {},
): Promise<Response> {
  const origin = request.headers.get('origin');
  const cors: Record<string, string> = {
    'x-content-type-options': 'nosniff',
    vary: 'Origin',
  };
  if (origin && origin === env.APP_ORIGIN) {
    cors['access-control-allow-origin'] = origin;
    cors['access-control-expose-headers'] = 'content-length, content-range, accept-ranges';
  }

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        ...cors,
        'access-control-allow-methods': 'GET, HEAD, OPTIONS',
        'access-control-allow-headers': 'range',
        'access-control-max-age': '86400',
      },
    });
  }
  if (request.method !== 'GET' && request.method !== 'HEAD')
    return plain(405, 'Method not allowed', { allow: 'GET, HEAD, OPTIONS', ...cors });

  const url = new URL(request.url);
  let key: string;
  try {
    key = decodeURIComponent(url.pathname.slice(1));
  } catch {
    return plain(404, 'Not found', cors);
  }
  if (!KEY_PATTERN.test(key) || key.split('/').some((part) => part === '.' || part === '..'))
    return plain(404, 'Not found', cors);

  const now = (options.now ?? (() => Date.now() / 1000))();
  const signed = key.startsWith('v/');
  if (signed && !(await authorized(env, key, url, now)))
    return plain(403, 'Invalid or expired url', cors);

  const rangeHeader = request.headers.get('range');
  const cacheable = !rangeHeader && request.method === 'GET';
  if (cacheable && options.cache) {
    const hit = await options.cache.match(cacheKeyFor(url));
    if (hit) {
      const headers = new Headers(hit.headers);
      for (const [name, value] of Object.entries(cors)) headers.set(name, value);
      return new Response(hit.body, { status: hit.status, headers });
    }
  }

  const head = await env.MEDIA.head(key);
  if (!head) return plain(404, 'Not found', cors);

  const headers: Record<string, string> = {
    ...cors,
    'content-type': contentType(key),
    'accept-ranges': 'bytes',
    'cache-control': SEGMENT_CACHE,
  };
  if (head.httpEtag) headers.etag = head.httpEtag;

  const range = parseRange(rangeHeader, head.size);
  if (range === 'invalid')
    return new Response(null, {
      status: 416,
      headers: { ...headers, 'content-range': `bytes */${head.size}` },
    });

  if (request.method === 'HEAD') {
    headers['content-length'] = String(range ? range.length : head.size);
    return new Response(null, { status: range ? 206 : 200, headers });
  }

  const object = await env.MEDIA.get(key, range ? { range } : undefined);
  if (!object) return plain(404, 'Not found', cors);

  if (range) {
    headers['content-range'] = `bytes ${range.offset}-${range.offset + range.length - 1}/${head.size}`;
    headers['content-length'] = String(range.length);
    return new Response(object.body, { status: 206, headers });
  }
  headers['content-length'] = String(head.size);
  const response = new Response(object.body, { status: 200, headers });
  if (cacheable && options.cache) {
    // Cache without the CORS headers so one entry serves any origin.
    const stored = new Response(response.clone().body, { status: 200, headers: { ...headers } });
    stored.headers.delete('access-control-allow-origin');
    stored.headers.delete('access-control-expose-headers');
    await options.cache.put(cacheKeyFor(url), stored);
  }
  return response;
}
