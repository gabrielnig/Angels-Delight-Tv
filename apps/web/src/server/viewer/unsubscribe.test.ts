import { randomBytes } from 'node:crypto';
import { signUnsubscribeToken } from '@ad/queue';
import { describe, expect, it, vi } from 'vitest';
import { handleUnsubscribe } from './unsubscribe';

const kek = new Uint8Array(randomBytes(32));
const NOW = new Date('2026-11-24T06:25:00Z');
const ACCOUNT = '0194a000-0000-7000-8000-000000000001';

function deps() {
  const unsubscribe = vi.fn(async () => true);
  return { kek, now: () => NOW, unsubscribe };
}
const request = (method: string, token?: string) =>
  new Request(`https://tv.example.org/unsubscribe/notices${token ? `?token=${encodeURIComponent(token)}` : ''}`, { method });

describe('one click unsubscribe (M44-S15 AC3)', () => {
  it('GET with a good token turns the digest off without signing in and says so', async () => {
    const d = deps();
    const response = await handleUnsubscribe(request('GET', signUnsubscribeToken(kek, ACCOUNT, NOW)), d);
    expect(response.status).toBe(200);
    expect(d.unsubscribe).toHaveBeenCalledWith(ACCOUNT);
    const html = await response.text();
    expect(html).toContain('You are unsubscribed');
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(response.headers.get('x-robots-tag')).toContain('noindex');
  });

  it('POST (the List-Unsubscribe-Post one click) works the same', async () => {
    const d = deps();
    const response = await handleUnsubscribe(request('POST', signUnsubscribeToken(kek, ACCOUNT, NOW)), d);
    expect(response.status).toBe(200);
    expect(d.unsubscribe).toHaveBeenCalledWith(ACCOUNT);
  });

  it('refuses a missing, forged, other key or expired token and changes nothing', async () => {
    const d = deps();
    const good = signUnsubscribeToken(kek, ACCOUNT, NOW);
    const later = { ...d, now: () => new Date(NOW.getTime() + 400 * 86_400_000) };
    for (const [req, dep] of [
      [request('GET'), d],
      [request('GET', `${good}x`), d],
      [request('GET', signUnsubscribeToken(new Uint8Array(randomBytes(32)), ACCOUNT, NOW)), d],
      [request('GET', good), later],
    ] as const) {
      const response = await handleUnsubscribe(req, dep);
      expect(response.status).toBe(400);
      expect(await response.text()).toContain('link is not valid');
    }
    expect(d.unsubscribe).not.toHaveBeenCalled();
  });

  it('says it could not finish when the database fails, so the person tries again', async () => {
    const d = { ...deps(), unsubscribe: vi.fn(async () => Promise.reject(new Error('down'))) };
    const response = await handleUnsubscribe(request('GET', signUnsubscribeToken(kek, ACCOUNT, NOW)), d);
    expect(response.status).toBe(500);
    expect(await response.text()).toContain('Try the link again');
  });

  it('is the same answer for an account with no settings, so a token reveals nothing', async () => {
    const d = { ...deps(), unsubscribe: vi.fn(async () => false) };
    const response = await handleUnsubscribe(request('GET', signUnsubscribeToken(kek, ACCOUNT, NOW)), d);
    expect(response.status).toBe(200);
  });
});
