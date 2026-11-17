import { describe, expect, it } from 'vitest';
import { createHttpTransport } from './http-transport';
import { TransportError } from './types';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('http transport', () => {
  it('starts a new session and resumes an existing one from the server part list', async () => {
    const calls: string[] = [];
    const fetcher = async (url: string, init?: RequestInit) => {
      calls.push(`${init?.method ?? 'GET'} ${url}`);
      if (url === '/api/admin/uploads')
        return json({ uploadId: 'u1', partSize: 8388608, totalParts: 3 });
      if (url === '/api/admin/uploads/u1')
        return json({ uploadId: 'u1', partSize: 8388608, totalParts: 3, uploadedParts: [1, 2] });
      throw new Error(`unexpected ${url}`);
    };
    const transport = createHttpTransport({ fetch: fetcher as never, putPart: async () => {} });
    const fresh = await transport.start({
      fingerprint: 'f',
      name: 'a.mp4',
      size: 20_000_000,
      type: 'video/mp4',
    });
    expect(fresh).toEqual({
      uploadId: 'u1',
      partSizeBytes: 8388608,
      totalParts: 3,
      uploadedParts: [],
    });
    const resumed = await transport.start({
      fingerprint: 'f',
      name: 'a.mp4',
      size: 20_000_000,
      type: 'video/mp4',
      resumeUploadId: 'u1',
    });
    expect(resumed.uploadedParts).toEqual([1, 2]);
    expect(calls).toEqual(['POST /api/admin/uploads', 'GET /api/admin/uploads/u1']);
  });

  it('asks for a presigned url then puts the part to it', async () => {
    const puts: Array<{ url: string; size: number }> = [];
    const fetcher = async (url: string) => {
      expect(url).toBe('/api/admin/uploads/u1/parts');
      return json({ urls: { '2': 'https://bucket.example/part2' } });
    };
    const transport = createHttpTransport({
      fetch: fetcher as never,
      putPart: async ({ url, blob }) => void puts.push({ url, size: blob.size }),
    });
    await transport.uploadPart({
      uploadId: 'u1',
      partNumber: 2,
      blob: new Blob(['abcd']),
      signal: new AbortController().signal,
      onProgress: () => {},
    });
    expect(puts).toEqual([{ url: 'https://bucket.example/part2', size: 4 }]);
  });

  it('maps a 4xx start answer to a rejected error and a fetch failure to a network error', async () => {
    const rejected = createHttpTransport({
      fetch: (async () => json({ error: 'Too big' }, 413)) as never,
      putPart: async () => {},
    });
    await expect(
      rejected.start({ fingerprint: 'f', name: 'a.mp4', size: 1, type: 'video/mp4' }),
    ).rejects.toMatchObject({ kind: 'rejected' });

    const offline = createHttpTransport({
      fetch: (async () => {
        throw new TypeError('Failed to fetch');
      }) as never,
      putPart: async () => {},
    });
    const error = await offline.complete('u1').catch((e: unknown) => e as TransportError);
    expect(error).toBeInstanceOf(TransportError);
    expect((error as TransportError).kind).toBe('network');
  });
});
