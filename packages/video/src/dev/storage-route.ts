import { Readable } from 'node:stream';
import type { LocalStorage } from '@ad/storage';
import { verifyLocalUrl } from '@ad/storage';

export interface DevStorageDeps {
  nodeEnv: string;
  secret: Uint8Array;
  /** Local storage instances by bucket name. */
  buckets: Record<string, LocalStorage>;
  now?: () => number;
}

const text = (status: number, message: string) =>
  new Response(message, {
    status,
    headers: { 'cache-control': 'no-store', 'content-type': 'text/plain' },
  });

/**
 * Handler for /api/dev-storage/{bucket}/{get|part}, the local driver's stand-in for presigned S3 urls.
 * It does not exist in production: the env loader already rejects STORAGE_DRIVER=local there and this is a second guard.
 */
export function createDevStorageHandler(
  deps: DevStorageDeps,
): (request: Request) => Promise<Response> {
  return async (request) => {
    if (deps.nodeEnv === 'production') return text(404, 'Not found');
    const verified = verifyLocalUrl(deps.secret, request.url, (deps.now ?? Date.now)());
    if (!verified) return text(403, 'Invalid or expired url');
    const storage = deps.buckets[verified.bucket];
    if (!storage) return text(404, 'Not found');

    if (verified.kind === 'get') {
      if (request.method !== 'GET') return text(405, 'Method not allowed');
      try {
        const stream = await storage.get(verified.key);
        return new Response(Readable.toWeb(stream) as ReadableStream, {
          headers: { 'cache-control': 'no-store', 'content-type': 'application/octet-stream' },
        });
      } catch {
        return text(404, 'Not found');
      }
    }

    if (request.method !== 'PUT') return text(405, 'Method not allowed');
    const body = new Uint8Array(await request.arrayBuffer());
    if (body.byteLength !== verified.sizeBytes)
      return text(400, 'Part size does not match the signed size');
    try {
      const etag = await storage.receivePart(
        verified.key,
        verified.uploadId,
        verified.partNumber,
        body,
        verified.sizeBytes,
      );
      return new Response(null, {
        status: 200,
        headers: { etag: `"${etag.replace(/"/g, '')}"`, 'cache-control': 'no-store' },
      });
    } catch {
      return text(400, 'Part could not be stored');
    }
  };
}
