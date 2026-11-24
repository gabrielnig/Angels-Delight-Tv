import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const flow = vi.hoisted(() => ({ current: null as null | Record<string, unknown> }));
vi.mock('../../../../server/auth/google-runtime', () => ({ googleFlow: () => flow.current }));

import { GET as callback } from './callback/route';
import { GET as start } from './start/route';

const req = (path: string) => new NextRequest(`https://tv.example.org${path}`);

beforeEach(() => {
  flow.current = null;
});

describe('google routes', () => {
  it('404 when keys missing', async () => {
    expect((await start(req('/api/auth/google/start'))).status).toBe(404);
    expect((await callback(req('/api/auth/google/callback?code=c&state=s'))).status).toBe(404);
  });

  it('404 when the site setting is off', async () => {
    flow.current = {
      start: async () => ({ kind: 'not_found' }),
      available: async () => false,
    };
    expect((await start(req('/api/auth/google/start'))).status).toBe(404);
    expect((await callback(req('/api/auth/google/callback?code=c'))).status).toBe(404);
  });

  it('start sends the browser to Google and passes next through the flow', async () => {
    const begin = vi.fn(async () => ({
      kind: 'redirect',
      url: 'https://accounts.google.com/auth?x=1',
    }));
    flow.current = { start: begin };
    const response = await start(req('/api/auth/google/start?next=%2Flibrary'));
    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe('https://accounts.google.com/auth?x=1');
    expect(begin).toHaveBeenCalledWith({ next: '/library', link: false });
  });

  it('a connect request without a session goes to sign in', async () => {
    flow.current = { start: async () => ({ kind: 'sign_in' }) };
    const response = await start(req('/api/auth/google/start?link=1'));
    expect(response.headers.get('location')).toBe('https://tv.example.org/sign-in');
  });

  it('callback without a cookie fails generic', async () => {
    // The real flow: no cookie reaches the service, which answers failed.
    flow.current = {
      available: async () => true,
      callback: async () => ({ redirect: '/sign-in/google-failed' }),
    };
    const response = await callback(req('/api/auth/google/callback?code=c&state=s'));
    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe('https://tv.example.org/sign-in/google-failed');
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('next is sanitised by the flow before Google is called', async () => {
    const begin = vi.fn(async () => ({ kind: 'redirect', url: 'https://accounts.google.com/a' }));
    flow.current = { start: begin };
    await start(req('/api/auth/google/start?next=https%3A%2F%2Fevil.test'));
    // The route hands the raw value over. The flow owns the sanitising (see google-flow.test.ts).
    expect(begin).toHaveBeenCalledWith({ next: 'https://evil.test', link: false });
  });

  it('forwards the callback parameters and lands where the flow says', async () => {
    const run = vi.fn(async () => ({ redirect: '/library' }));
    flow.current = { available: async () => true, callback: run };
    const response = await callback(req('/api/auth/google/callback?code=c&state=s&error=e'));
    expect(run).toHaveBeenCalledWith({ code: 'c', state: 's', error: 'e' });
    expect(response.headers.get('location')).toBe('https://tv.example.org/library');
  });
});
