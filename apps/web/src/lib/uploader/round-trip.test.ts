import { Unauthorized, type Actor } from '@ad/shared';
import { createUploadHandlers, validateUploadRequest } from '@ad/video';
import { describe, expect, it } from 'vitest';
import { createUploader } from './engine';
import { fakeFile } from './fake-transport';
import { createHttpTransport } from './http-transport';

const actor: Actor = { accountId: '0192f0a0-0000-7000-8000-000000000001', role: 'editor' };
const LIMITS = { maxBytes: 5 * 1024 ** 3, partBytes: 8 * 1024 * 1024 };

/** The real handlers and the real request validation, with the database and storage replaced in memory. */
function server(signedIn = true) {
  const puts: string[] = [];
  const handlers = createUploadHandlers({
    getActor: async () => {
      if (!signedIn) throw new Unauthorized();
      return actor;
    },
    service: {
      create: async (_actor: Actor, request: Parameters<typeof validateUploadRequest>[0]) => {
        const valid = validateUploadRequest(request, LIMITS);
        const totalParts = Math.ceil(valid.size / LIMITS.partBytes);
        return {
          uploadId: 'u1',
          videoId: 'v1',
          partSize: LIMITS.partBytes,
          totalParts,
          uploadedParts: [],
          status: 'initiated',
          filename: valid.filename,
          size: valid.size,
          resumed: false,
        };
      },
      describe: async () => {
        throw new Error('not used');
      },
      presignParts: async (_a: Actor, _id: string, numbers: number[]) =>
        Object.fromEntries(numbers.map((n) => [String(n), `https://bucket.example/p${n}`])),
      complete: async () => ({ uploadId: 'u1', videoId: 'v1', status: 'completed' }),
      abort: async () => undefined,
    } as never,
  });
  const route = (url: string, init?: RequestInit) => {
    const request = new Request(`http://app${url}`, init);
    if (url === '/api/admin/uploads') return handlers.create(request);
    if (url === '/api/admin/uploads/u1/parts') return handlers.parts(request, 'u1');
    if (url === '/api/admin/uploads/u1/complete') return handlers.complete(request, 'u1');
    return Promise.resolve(new Response(null, { status: 404 }));
  };
  const transport = createHttpTransport({
    fetch: route,
    putPart: async ({ url }) => void puts.push(url),
  });
  return { transport, puts };
}

describe('http transport against the real upload handlers', () => {
  it('uploads an iOS style file from pick to done', async () => {
    const { transport, puts } = server();
    const uploader = createUploader({ transport, sleep: async () => {} });
    const file = {
      ...fakeFile('copy_7B7CA63F-80F0-49B2-AFC3-05A3715D1698.mov', 20 * 1024 * 1024),
      type: 'video/quicktime',
    };
    uploader.add(file);
    await uploader.idle();
    const [lane] = uploader.getLanes();
    expect(lane!.status).toBe('done');
    expect(puts.sort()).toEqual([
      'https://bucket.example/p1',
      'https://bucket.example/p2',
      'https://bucket.example/p3',
    ]);
  });

  it('accepts the empty type iOS and Windows send for mov and mkv', async () => {
    const { transport } = server();
    const uploader = createUploader({ transport, sleep: async () => {} });
    uploader.add({ ...fakeFile('IMG_0001.MOV', 1024), type: '' });
    await uploader.idle();
    expect(uploader.getLanes()[0]!.status).toBe('done');
  });

  it('shows the server reason when the server refuses the file', async () => {
    const { transport } = server();
    const uploader = createUploader({ transport, sleep: async () => {} });
    uploader.add({ ...fakeFile('clip.mp4', 1024), type: 'video/quicktime' });
    await uploader.idle();
    const [lane] = uploader.getLanes();
    expect(lane!.status).toBe('failed');
    expect(lane!.message).toBe(
      'The file type does not match its name. Remove it and choose another file.',
    );
    expect(lane!.errorStatus).toBe(422);
  });

  it('asks to sign in again when the session ended', async () => {
    const { transport } = server(false);
    const uploader = createUploader({ transport, sleep: async () => {} });
    uploader.add(fakeFile('a.mp4', 1024));
    await uploader.idle();
    const [lane] = uploader.getLanes();
    expect(lane!.message).toBe('Your session ended. Sign in again, then press Retry.');
    expect(lane!.errorStatus).toBe(401);
  });
});
