import { describe, expect, it, vi } from 'vitest';
import { reportRequestError } from './request-error';

const reporter = () => ({ enabled: true, capture: vi.fn(), flush: async () => {} });
const logger = () => ({ error: vi.fn() }) as never;

describe('reportRequestError (M24-S03 AC1 for pages and actions)', () => {
  it('captures with the route template and the request id, not the concrete url', () => {
    const r = reporter();
    const error = new Error('boom');
    reportRequestError(
      error,
      {
        path: '/watch/abc123?token=secret',
        method: 'GET',
        headers: { 'x-request-id': 'req_abcdef123' },
      },
      { routePath: '/watch/[id]', routeType: 'render', routerKind: 'App Router' },
      { reporter: r, logger: logger() },
    );
    expect(r.capture).toHaveBeenCalledWith(error, {
      route: '/watch/[id]',
      requestId: 'req_abcdef123',
    });
  });

  it('falls back to a path without the query when no template is known, and makes an id', () => {
    const r = reporter();
    reportRequestError(
      new Error('x'),
      { path: '/somewhere?email=a@b.c', method: 'POST', headers: {} },
      { routePath: '', routeType: 'action', routerKind: 'App Router' },
      { reporter: r, logger: logger() },
    );
    const ctx = r.capture.mock.calls[0]![1];
    expect(ctx.route).toBe('/somewhere');
    expect(ctx.requestId).toMatch(/^req_/);
  });

  it('never throws, even when the reporter or logger fail', () => {
    const r = {
      enabled: true,
      capture: () => {
        throw new Error('tracker');
      },
      flush: async () => {},
    };
    const log = {
      error: () => {
        throw new Error('log');
      },
    } as never;
    expect(() =>
      reportRequestError(
        new Error('x'),
        { path: '/a', method: 'GET', headers: {} },
        { routePath: '/a', routeType: 'render', routerKind: 'App Router' },
        { reporter: r, logger: log },
      ),
    ).not.toThrow();
  });
});
