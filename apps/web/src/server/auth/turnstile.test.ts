import { describe, expect, it, vi } from 'vitest';
import { turnstileFromEnv, verifyTurnstile } from './turnstile';

const ok = (body: unknown, status = 200) =>
  vi.fn(async () => new Response(JSON.stringify(body), { status }));

describe('turnstileFromEnv', () => {
  it('is off without keys', () => {
    expect(turnstileFromEnv({})).toBeNull();
    expect(turnstileFromEnv({ TURNSTILE_SITE_KEY: 'site' })).toBeNull();
    expect(turnstileFromEnv({ TURNSTILE_SECRET_KEY: 'secret' })).toBeNull();
    expect(turnstileFromEnv({ TURNSTILE_SITE_KEY: '', TURNSTILE_SECRET_KEY: '' })).toBeNull();
  });
  it('is on with both keys', () => {
    expect(
      turnstileFromEnv({ TURNSTILE_SITE_KEY: 'site', TURNSTILE_SECRET_KEY: 'secret' }),
    ).toEqual({
      siteKey: 'site',
      secretKey: 'secret',
    });
  });
});

describe('verifyTurnstile', () => {
  const keys = { siteKey: 'site', secretKey: 'secret' };

  it('posts the secret, token and address and accepts a success', async () => {
    const fetcher = ok({ success: true });
    expect(await verifyTurnstile(keys, 'tok', '203.0.113.9', fetcher)).toBe(true);
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://challenges.cloudflare.com/turnstile/v0/siteverify');
    const body = new URLSearchParams(String(init.body));
    expect(body.get('secret')).toBe('secret');
    expect(body.get('response')).toBe('tok');
    expect(body.get('remoteip')).toBe('203.0.113.9');
  });

  it('leaves the address out when it is unknown', async () => {
    const fetcher = ok({ success: true });
    await verifyTurnstile(keys, 'tok', null, fetcher);
    const init = (fetcher.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect(new URLSearchParams(String(init.body)).has('remoteip')).toBe(false);
  });

  it('refuses a missing, empty or oversized token without calling Cloudflare', async () => {
    const fetcher = ok({ success: true });
    expect(await verifyTurnstile(keys, undefined, null, fetcher)).toBe(false);
    expect(await verifyTurnstile(keys, '', null, fetcher)).toBe(false);
    expect(await verifyTurnstile(keys, 'x'.repeat(2049), null, fetcher)).toBe(false);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('refuses a failed check, a bad status and a network error (fails closed)', async () => {
    expect(await verifyTurnstile(keys, 't', null, ok({ success: false }))).toBe(false);
    expect(await verifyTurnstile(keys, 't', null, ok({ success: true }, 500))).toBe(false);
    expect(
      await verifyTurnstile(
        keys,
        't',
        null,
        vi.fn(async () => Promise.reject(new Error('down'))),
      ),
    ).toBe(false);
    expect(
      await verifyTurnstile(
        keys,
        't',
        null,
        vi.fn(async () => new Response('nope')),
      ),
    ).toBe(false);
  });
});
