import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { GET } from './route';

describe('/tv', () => {
  it('sets the preference to on and redirects home', async () => {
    const res = await GET(new NextRequest('https://tv.example.org/tv'));
    expect(res.status).toBe(302);
    expect(new URL(res.headers.get('location') ?? '').pathname).toBe('/');
    const cookie = res.headers.get('set-cookie') ?? '';
    expect(cookie).toContain('ad_tv=on');
    expect(cookie).toContain('Path=/');
    expect(cookie.toLowerCase()).toContain('samesite=lax');
    expect(cookie.toLowerCase()).toMatch(/max-age=\d+/);
  });

  it('is not cacheable', async () => {
    const res = await GET(new NextRequest('https://tv.example.org/tv'));
    expect(res.headers.get('cache-control')).toContain('no-store');
  });
});
