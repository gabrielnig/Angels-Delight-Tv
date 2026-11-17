import { describe, expect, it, vi } from 'vitest';
import { withRequest } from './with-request';
import type { Logger } from '@ad/shared';

const fakeLogger = () => {
  const lines: Array<{ level: string; message: string; fields?: Record<string, unknown> }> = [];
  const logger: Logger = {
    debug: (message, fields) => void lines.push({ level: 'debug', message, fields }),
    info: (message, fields) => void lines.push({ level: 'info', message, fields }),
    warn: (message, fields) => void lines.push({ level: 'warn', message, fields }),
    error: (message, fields) => void lines.push({ level: 'error', message, fields }),
    child: () => logger,
  };
  return { logger, lines };
};
const req = (url = 'https://tv.example/api/x?token=secret', headers: Record<string, string> = {}) =>
  new Request(url, { headers });

describe('withRequest', () => {
  it('adds a request id header and logs one line without the query string', async () => {
    const { logger, lines } = fakeLogger();
    const handler = withRequest(async () => Response.json({ ok: true }), {
      route: '/api/x',
      logger,
    });
    const res = await handler(req());
    expect(res.headers.get('x-request-id')).toMatch(/^req_/);
    expect(lines).toHaveLength(1);
    expect(lines[0]!.fields).toMatchObject({ route: '/api/x', status: 200, method: 'GET' });
    expect(JSON.stringify(lines)).not.toContain('secret');
  });

  it('reuses a valid inbound id and passes it to the handler', async () => {
    const { logger } = fakeLogger();
    let seen = '';
    const handler = withRequest(
      async (_r, ctx) => {
        seen = ctx.requestId;
        return new Response('ok');
      },
      { route: '/x', logger },
    );
    const res = await handler(req('https://tv.example/x', { 'x-request-id': 'trace-abc12345' }));
    expect(seen).toBe('trace-abc12345');
    expect(res.headers.get('x-request-id')).toBe('trace-abc12345');
  });

  it('turns a throw into a 500 with the reference id, reports it, and hides the message', async () => {
    const { logger, lines } = fakeLogger();
    const capture = vi.fn();
    const handler = withRequest(
      async () => {
        throw new Error('db exploded at 10.0.0.5');
      },
      { route: '/api/x', logger, reporter: { enabled: true, capture, flush: async () => {} } },
    );
    const res = await handler(req());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toMatchObject({
      code: 'internal_error',
      requestId: res.headers.get('x-request-id'),
    });
    expect(JSON.stringify(body)).not.toContain('10.0.0.5');
    expect(capture).toHaveBeenCalledWith(expect.any(Error), {
      route: '/api/x',
      requestId: body.error.requestId,
    });
    expect(lines.some((line) => line.level === 'error')).toBe(true);
  });

  it('keeps serving when the logger itself throws', async () => {
    const broken: Logger = {
      debug() {},
      info() {
        throw new Error('log down');
      },
      warn() {},
      error() {
        throw new Error('log down');
      },
      child() {
        return broken;
      },
    };
    const ok = await withRequest(async () => new Response('fine'), { route: '/x', logger: broken })(
      req(),
    );
    expect(await ok.text()).toBe('fine');
    const bad = await withRequest(
      async () => {
        throw new Error('x');
      },
      { route: '/x', logger: broken },
    )(req());
    expect(bad.status).toBe(500);
  });
});
