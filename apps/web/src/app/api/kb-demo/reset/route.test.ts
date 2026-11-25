import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { POST } from './route';

const req = (headers: Record<string, string> = { 'x-kb-demo': 'reset' }, host = 'localhost:3141') =>
  new Request(`http://${host}/api/kb-demo/reset`, {
    method: 'POST',
    headers: { host, ...headers },
  });

describe('POST /api/kb-demo/reset', () => {
  beforeEach(() => {
    process.env.KB_DEMO = 'on';
    process.env.ADMIN_DATA = 'fixture';
  });
  afterEach(() => {
    delete process.env.KB_DEMO;
    delete process.env.ADMIN_DATA;
  });

  it('resets and returns the pinned clock', async () => {
    const res = await POST(req());
    expect(res.status).toBe(200);
    const body = (await res.json()) as { now: number };
    expect(new Date(body.now).toISOString()).toBe('2026-03-10T09:00:00.000Z');
  });

  it('is not found unless KB_DEMO is on', async () => {
    delete process.env.KB_DEMO;
    expect((await POST(req())).status).toBe(404);
  });

  it('is not found in production', async () => {
    const env = process.env as Record<string, string | undefined>;
    const before = env.NODE_ENV;
    env.NODE_ENV = 'production';
    try {
      expect((await POST(req())).status).toBe(404);
    } finally {
      env.NODE_ENV = before;
    }
  });

  it('needs the marker header', async () => {
    expect((await POST(req({}))).status).toBe(403);
  });

  it('refuses a host that is not local', async () => {
    expect((await POST(req({ 'x-kb-demo': 'reset' }, 'admin.angelsdelight.tv'))).status).toBe(403);
  });
});
