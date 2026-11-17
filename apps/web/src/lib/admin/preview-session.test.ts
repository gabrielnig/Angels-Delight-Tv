import { SessionError } from '@ad/player';
import { describe, expect, it, vi } from 'vitest';
import { createPreviewSessionProvider } from './preview-session';

const reply = (status: number, body?: unknown) =>
  vi.fn(async () => new Response(body === undefined ? null : JSON.stringify(body), { status }));

describe('createPreviewSessionProvider', () => {
  it('asks for a staff preview session without a profile and resolves the playlist address', async () => {
    const fetchFn = reply(200, {
      token: 'tok',
      expiresAt: '2026-06-01T10:30:00Z',
      masterUrl: '/api/play/v1/master.m3u8',
      preview: true,
    });
    const session = await createPreviewSessionProvider({
      appOrigin: 'https://admin.test/',
      fetchFn,
    }).createSession('v1');
    expect(fetchFn).toHaveBeenCalledWith(
      'https://admin.test/api/play/v1/session',
      expect.objectContaining({ method: 'POST', credentials: 'include', body: '{"preview":true}' }),
    );
    expect(session).toEqual({
      token: 'tok',
      expiresAt: Date.parse('2026-06-01T10:30:00Z'),
      masterUrl: 'https://admin.test/api/play/v1/master.m3u8',
    });
  });

  it.each([
    [401, 'auth'],
    [403, 'gone'],
    [404, 'gone'],
    [429, 'rate-limited'],
    [500, 'network'],
  ])('maps status %i to %s', async (status, kind) => {
    const provider = createPreviewSessionProvider({
      appOrigin: 'https://a.test',
      fetchFn: reply(status),
    });
    await expect(provider.createSession('v1')).rejects.toMatchObject({ kind });
    await expect(provider.createSession('v1')).rejects.toBeInstanceOf(SessionError);
  });

  it('treats a dropped connection and a malformed answer as network trouble', async () => {
    const down = createPreviewSessionProvider({
      appOrigin: 'https://a.test',
      fetchFn: vi.fn(async () => {
        throw new TypeError('offline');
      }),
    });
    await expect(down.createSession('v1')).rejects.toMatchObject({ kind: 'network' });
    const bad = createPreviewSessionProvider({
      appOrigin: 'https://a.test',
      fetchFn: reply(200, { token: 1 }),
    });
    await expect(bad.createSession('v1')).rejects.toMatchObject({ kind: 'network' });
  });
});
