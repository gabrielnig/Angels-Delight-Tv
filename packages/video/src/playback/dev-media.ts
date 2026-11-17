import { Readable } from 'node:stream';
import type { StorageAdapter } from '@ad/storage';
import { verifyMediaSignature } from '../signing';

export interface DevMediaDeps {
  nodeEnv: string;
  mediaSecret: Uint8Array;
  media: Pick<StorageAdapter, 'get' | 'head'>;
  now?: () => number;
}

const text = (status: number, message: string) =>
  new Response(message, {
    status,
    headers: { 'cache-control': 'no-store', 'content-type': 'text/plain' },
  });

const KEY = /^(v|cap|img)\/[A-Za-z0-9_./-]+$/;

function contentType(key: string): string {
  if (key.endsWith('.ts')) return 'video/mp2t';
  if (key.endsWith('.vtt')) return 'text/vtt; charset=utf-8';
  if (key.endsWith('.webp')) return 'image/webp';
  return 'application/octet-stream';
}

async function slice(storage: DevMediaDeps['media'], key: string, start: number, end: number) {
  const chunks: Buffer[] = [];
  let offset = 0;
  for await (const chunk of await storage.get(key)) {
    const buf = Buffer.from(chunk as Uint8Array);
    const from = Math.max(start - offset, 0);
    const to = Math.min(end + 1 - offset, buf.length);
    if (to > from) chunks.push(buf.subarray(from, to));
    offset += buf.length;
    if (offset > end) break;
  }
  return Buffer.concat(chunks);
}

/**
 * Local stand-in for the edge worker (ARCHITECTURE section 10): verifies the same HMAC and serves from the
 * media bucket. Refuses to run in production, where apps/edge is the only media origin.
 * `key` is the object key taken from the request path, for example `v/{prefix}/720/seg_00001.ts`.
 */
export function createDevMediaHandler(
  deps: DevMediaDeps,
): (request: Request, key: string) => Promise<Response> {
  return async (request, key) => {
    if (deps.nodeEnv === 'production') return text(404, 'Not found');
    if (request.method !== 'GET' && request.method !== 'HEAD')
      return text(405, 'Method not allowed');
    if (!KEY.test(key) || key.includes('..') || key.includes('//')) return text(404, 'Not found');
    if (key.startsWith('v/')) {
      const url = new URL(request.url);
      const exp = Number(url.searchParams.get('exp'));
      const sig = url.searchParams.get('sig') ?? '';
      const now = (deps.now ?? (() => Date.now() / 1000))();
      if (!verifyMediaSignature(deps.mediaSecret, key, exp, sig, now))
        return text(403, 'Invalid or expired url');
    }
    const info = await deps.media.head(key);
    if (!info) return text(404, 'Not found');
    const headers: Record<string, string> = {
      'content-type': contentType(key),
      'accept-ranges': 'bytes',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
    };
    const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get('range') ?? '');
    if (range && (range[1] || range[2])) {
      let start = range[1] ? Number(range[1]) : info.bytes - Number(range[2]);
      let end = range[1] && range[2] ? Number(range[2]) : info.bytes - 1;
      end = Math.min(end, info.bytes - 1);
      start = Math.max(start, 0);
      if (start > end || start >= info.bytes)
        return new Response(null, {
          status: 416,
          headers: { ...headers, 'content-range': `bytes */${info.bytes}` },
        });
      return new Response(
        request.method === 'HEAD' ? null : await slice(deps.media, key, start, end),
        {
          status: 206,
          headers: {
            ...headers,
            'content-range': `bytes ${start}-${end}/${info.bytes}`,
            'content-length': String(end - start + 1),
          },
        },
      );
    }
    headers['content-length'] = String(info.bytes);
    if (request.method === 'HEAD') return new Response(null, { headers });
    return new Response(Readable.toWeb(await deps.media.get(key)) as ReadableStream, { headers });
  };
}
