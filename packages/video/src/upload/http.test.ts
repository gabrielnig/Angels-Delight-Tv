import { Forbidden, Unauthorized, type Actor } from '@ad/shared';
import { describe, expect, it } from 'vitest';
import { createUploadHandlers } from './http';
import { UploadIncomplete } from './service';

const actor: Actor = { accountId: '0192f0a0-0000-7000-8000-000000000001', role: 'editor' };
const state = {
  uploadId: 'u1',
  videoId: 'v1',
  partSize: 8,
  totalParts: 2,
  uploadedParts: [],
  status: 'initiated',
  filename: 'a.mp4',
  size: 10,
};

function setup(overrides: Record<string, unknown> = {}) {
  const calls: Record<string, unknown[]> = {};
  const record = (name: string, value: unknown) => ((calls[name] ??= []).push(value), value);
  const service = {
    create: async (...args: unknown[]) => record('create', args) && { ...state, resumed: false },
    describe: async (...args: unknown[]) => record('describe', args) && state,
    presignParts: async (...args: unknown[]) => record('presign', args) && { '1': 'https://x/1' },
    complete: async (...args: unknown[]) =>
      record('complete', args) && { uploadId: 'u1', videoId: 'v1', status: 'completed' },
    abort: async (...args: unknown[]) => void record('abort', args),
    ...overrides,
  };
  const handlers = createUploadHandlers({
    service: service as never,
    getActor: async (request) => {
      if (!request.headers.get('cookie')) throw new Unauthorized();
      return actor;
    },
    assertSameOrigin: (request) => {
      if (request.headers.get('origin') === 'https://evil.example')
        throw new Forbidden('Cross site request');
    },
  });
  return { handlers, calls };
}

const post = (body: unknown, headers: Record<string, string> = { cookie: 's=1' }) =>
  new Request('http://app/api/admin/uploads', {
    method: 'POST',
    body: JSON.stringify(body),
    headers,
  });

describe('upload handlers', () => {
  it('creates an upload and returns the shape the admin upload client reads', async () => {
    const { handlers, calls } = setup();
    const response = await handlers.create(
      post({ name: 'a.mp4', size: 10, type: 'video/mp4', fingerprint: 'abcdefgh1234' }),
    );
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ uploadId: 'u1', partSize: 8, totalParts: 2 });
    expect(calls.create?.[0]).toEqual([
      actor,
      { name: 'a.mp4', size: 10, type: 'video/mp4', fingerprint: 'abcdefgh1234' },
      { replaceVideoId: undefined },
    ]);
  });

  it('answers 200 for a resumed session', async () => {
    const { handlers } = setup({ create: async () => ({ ...state, resumed: true }) });
    expect(
      (
        await handlers.create(
          post({ name: 'a.mp4', size: 10, type: 'video/mp4', fingerprint: 'abcdefgh1234' }),
        )
      ).status,
    ).toBe(200);
  });

  it('requires a session and refuses cross site writes before touching the service', async () => {
    const { handlers, calls } = setup();
    expect((await handlers.create(post({}, {}))).status).toBe(401);
    expect(
      (await handlers.create(post({}, { cookie: 's=1', origin: 'https://evil.example' }))).status,
    ).toBe(403);
    expect(calls.create).toBeUndefined();
  });

  it('describes, signs parts, completes and aborts', async () => {
    const { handlers, calls } = setup();
    const withCookie = { cookie: 's=1' };
    const described = await handlers.describe(
      new Request('http://app/x', { headers: withCookie }),
      'u1',
    );
    expect(await described.json()).toMatchObject({ uploadId: 'u1', uploadedParts: [] });
    const parts = await handlers.parts(post({ partNumbers: [1] }), 'u1');
    expect(await parts.json()).toEqual({ urls: { '1': 'https://x/1' } });
    expect(calls.presign?.[0]).toEqual([actor, 'u1', [1]]);
    expect((await handlers.complete(post({}), 'u1')).status).toBe(200);
    const aborted = await handlers.abort(
      new Request('http://app/x', { method: 'DELETE', headers: withCookie }),
      'u1',
    );
    expect(aborted.status).toBe(204);
  });

  it('rejects a parts body that is not a list of integers', async () => {
    const { handlers } = setup();
    expect((await handlers.parts(post({ partNumbers: 'all' }), 'u1')).status).toBe(422);
    expect((await handlers.parts(post({ partNumbers: [1.5] }), 'u1')).status).toBe(422);
  });

  it('tells the client which parts are missing when completion is refused', async () => {
    const { handlers } = setup({
      complete: async () => {
        throw new UploadIncomplete([2]);
      },
    });
    const response = await handlers.complete(post({}), 'u1');
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: { missing: [2] } });
  });
});
