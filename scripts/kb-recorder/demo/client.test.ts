import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { resetDemo } from './client';

let server: Server | undefined;
const start = (handler: Parameters<typeof createServer>[1]) =>
  new Promise<string>((res) => {
    server = createServer(handler).listen(0, '127.0.0.1', () =>
      res(`http://127.0.0.1:${(server!.address() as AddressInfo).port}`),
    );
  });
afterEach(() => new Promise<void>((res) => (server ? server.close(() => res()) : res())));

describe('resetDemo', () => {
  it('posts the marker header and returns the clock', async () => {
    let seen = '';
    const base = await start((req, res) => {
      seen = `${req.method} ${req.url} ${req.headers['x-kb-demo']}`;
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ now: 1773133200000 }));
    });
    expect(await resetDemo(base)).toEqual({ now: 1773133200000 });
    expect(seen).toBe('POST /api/kb-demo/reset reset');
  });

  it('explains how to start the demo stack when the route is missing', async () => {
    const base = await start((_req, res) => {
      res.statusCode = 404;
      res.end('Not found');
    });
    await expect(resetDemo(base)).rejects.toThrow(/KB_DEMO=on/);
  });

  it('refuses an origin that is not local before sending anything', async () => {
    await expect(resetDemo('https://admin.angelsdelight.tv')).rejects.toThrow(/refus/i);
  });
});
