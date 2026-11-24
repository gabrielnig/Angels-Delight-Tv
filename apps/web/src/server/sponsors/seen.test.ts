import { describe, expect, it } from 'vitest';
import { createSeenHandler } from './seen';

const ID = '0190a000-0000-7000-8000-000000000002';
const now = () => new Date('2027-01-05T10:00:00Z');
const handler = (...args: [] | [unknown]) =>
  createSeenHandler({
    resolveViewer: async () => ({
      profileId: null,
      audience: (args.length ? args[0] : 'general') as 'general',
    }),
    now,
    secure: true,
  });
const post = (body: unknown, cookie?: string) =>
  new Request('https://x.test/api/sponsors/seen', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

describe('POST /api/sponsors/seen', () => {
  it('sets the day cap cookie for a home banner view', async () => {
    const res = await handler()(post({ creativeId: ID, slot: 'home_banner' }));
    expect(res.status).toBe(204);
    const cookie = res.headers.get('set-cookie') ?? '';
    expect(cookie).toMatch(/^ad_spc=/);
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/Secure/);
    expect(cookie).toMatch(/SameSite=Lax/);
    expect(cookie).toMatch(/Max-Age=86400/);
    expect(decodeURIComponent(cookie.split(';')[0]!.split('=')[1]!)).toContain(ID);
  });
  it('uses a session cookie with no Max-Age for the player slots', async () => {
    const res = await handler()(post({ creativeId: ID, slot: 'player_after' }));
    const cookie = res.headers.get('set-cookie') ?? '';
    expect(cookie).toMatch(/^ad_sps=/);
    expect(cookie).not.toMatch(/Max-Age/);
  });
  it('adds to the count already in the cookie', async () => {
    const first = await handler()(post({ creativeId: ID, slot: 'home_banner' }));
    const pair = (first.headers.get('set-cookie') ?? '').split(';')[0]!;
    const second = await handler()(post({ creativeId: ID, slot: 'home_banner' }, pair));
    const value = decodeURIComponent(
      (second.headers.get('set-cookie') ?? '').split(';')[0]!.split('=')[1]!,
    );
    expect(JSON.parse(value)[`${ID}.h`]?.[1]).toBe(2);
  });
  it('sets nothing for kids or an unknown audience', async () => {
    for (const a of ['kids', undefined, 'General']) {
      const res = await handler(a)(post({ creativeId: ID, slot: 'home_banner' }));
      expect(res.status).toBe(204);
      expect(res.headers.get('set-cookie')).toBeNull();
    }
  });
  it('sets nothing when the viewer cannot be resolved', async () => {
    const h = createSeenHandler({
      resolveViewer: async () => {
        throw new Error('x');
      },
      now,
      secure: true,
    });
    const res = await h(post({ creativeId: ID, slot: 'home_banner' }));
    expect(res.headers.get('set-cookie')).toBeNull();
  });
  it('ignores bad bodies without a cookie', async () => {
    for (const body of [
      'not json',
      { creativeId: 'nope', slot: 'home_banner' },
      { creativeId: ID, slot: 'x' },
      '{'.repeat(5000),
    ]) {
      const res = await handler()(post(body));
      expect(res.headers.get('set-cookie')).toBeNull();
    }
  });
});
