import { describe, expect, it, vi } from 'vitest';
import { createErrorReporter, parseDsn } from './error-reporter';

const dsn = 'https://publickey@o123.ingest.example.io/4567';

describe('parseDsn', () => {
  it('extracts key, host and project', () => {
    expect(parseDsn(dsn)).toEqual({
      key: 'publickey',
      endpoint: 'https://o123.ingest.example.io/api/4567/envelope/',
    });
  });
  it('rejects junk', () => {
    expect(parseDsn('nope')).toBeNull();
    expect(parseDsn('https://host/1')).toBeNull();
  });
});

describe('createErrorReporter', () => {
  it('is a silent no-op when no DSN is configured (off by default)', () => {
    const fetchFn = vi.fn();
    const reporter = createErrorReporter({ dsn: undefined, release: 'r1', fetch: fetchFn });
    expect(reporter.enabled).toBe(false);
    reporter.capture(new Error('x'), { route: '/a', requestId: 'req_1' });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('sends an envelope with release, route and request id and no personal data', async () => {
    const calls: Array<{ url: string; init: { body: string; headers: Record<string, string> } }> =
      [];
    const reporter = createErrorReporter({
      dsn,
      release: 'abc123',
      fetch: async (url, init) => {
        calls.push({ url, init });
        return { ok: true };
      },
    });
    reporter.capture(new TypeError('failed for ada@example.com'), {
      route: '/api/me',
      requestId: 'req_9',
    });
    await reporter.flush();
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe('https://o123.ingest.example.io/api/4567/envelope/');
    expect(calls[0]!.init.headers['X-Sentry-Auth']).toContain('sentry_key=publickey');
    const [, , payload] = calls[0]!.init.body.split('\n').map((line) => JSON.parse(line));
    expect(payload).toMatchObject({
      release: 'abc123',
      level: 'error',
      tags: { route: '/api/me', request_id: 'req_9' },
      exception: { values: [{ type: 'TypeError' }] },
    });
    expect(JSON.stringify(payload)).not.toContain('ada@example.com');
    expect(payload.user).toBeUndefined();
  });

  it('groups noisy repeats: the same error on the same route is sent once a minute', async () => {
    let now = 0;
    const fetchFn = vi.fn(async () => ({ ok: true }));
    const reporter = createErrorReporter({ dsn, release: 'r', fetch: fetchFn, now: () => now });
    for (let i = 0; i < 5; i += 1) reporter.capture(new Error('same'), { route: '/a' });
    await reporter.flush();
    expect(fetchFn).toHaveBeenCalledTimes(1);
    now += 61_000;
    reporter.capture(new Error('same'), { route: '/a' });
    await reporter.flush();
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('ignores a tracking outage', async () => {
    const reporter = createErrorReporter({
      dsn,
      release: 'r',
      fetch: async () => {
        throw new Error('down');
      },
    });
    expect(() => reporter.capture(new Error('x'), {})).not.toThrow();
    await expect(reporter.flush()).resolves.toBeUndefined();
  });
});
