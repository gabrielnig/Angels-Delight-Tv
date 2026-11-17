import { describe, expect, it } from 'vitest';
import { createLogger } from './logger';

function capture(level: 'debug' | 'info' | 'warn' | 'error' = 'info') {
  const lines: string[] = [];
  const logger = createLogger({
    level,
    bindings: { app: 'test' },
    write: (line) => lines.push(line),
    now: () => new Date('2026-01-02T03:04:05.000Z'),
  });
  return {
    logger,
    lines,
    parsed: () => lines.map((line) => JSON.parse(line) as Record<string, unknown>),
  };
}

describe('createLogger', () => {
  it('writes one JSON line with time, level, message and bindings', () => {
    const { logger, parsed } = capture();
    logger.info('worker started', { queues: 2 });
    expect(parsed()).toEqual([
      {
        time: '2026-01-02T03:04:05.000Z',
        level: 'info',
        msg: 'worker started',
        app: 'test',
        queues: 2,
      },
    ]);
  });

  it('drops messages below the configured level', () => {
    const { logger, lines } = capture('warn');
    logger.debug('a');
    logger.info('b');
    logger.warn('c');
    logger.error('d');
    expect(lines).toHaveLength(2);
  });

  it('redacts fields that look like secrets, at any depth', () => {
    const { logger, parsed } = capture();
    logger.info('login', {
      email: 'a@b.c',
      password: 'hunter2',
      nested: { sessionToken: 'abc', apiKey: 'k', keep: 1 },
      headers: { Authorization: 'Bearer x', cookie: 'c=1' },
    });
    const entry = parsed()[0] as Record<string, Record<string, unknown>>;
    expect(entry.password).toBe('[redacted]');
    expect(entry.nested).toEqual({ sessionToken: '[redacted]', apiKey: '[redacted]', keep: 1 });
    expect(entry.headers).toEqual({ Authorization: '[redacted]', cookie: '[redacted]' });
    expect(entry.email).toBe('[redacted]');
  });

  it('serialises an Error with name, message and stack', () => {
    const { logger, parsed } = capture();
    logger.error('job failed', { err: new TypeError('bad input') });
    const err = (parsed()[0] as { err: Record<string, unknown> }).err;
    expect(err.name).toBe('TypeError');
    expect(err.message).toBe('bad input');
    expect(typeof err.stack).toBe('string');
  });

  it('child loggers add bindings without changing the parent', () => {
    const { logger, parsed } = capture();
    logger.child({ requestId: 'r1' }).info('hit');
    logger.info('plain');
    expect(parsed()[0]).toMatchObject({ requestId: 'r1' });
    expect(parsed()[1]).not.toHaveProperty('requestId');
  });

  it('does not throw on circular fields', () => {
    const { logger, lines } = capture();
    const loop: Record<string, unknown> = {};
    loop.self = loop;
    expect(() => logger.info('loop', { loop })).not.toThrow();
    expect(lines).toHaveLength(1);
  });
});

describe('createLogger email redaction', () => {
  it('redacts fields named email', () => {
    const { logger, lines } = capture();
    logger.info('sent', { email: 'ada@example.com', to_email: 'x@example.com' });
    expect(lines[0]).not.toContain('example.com');
  });

  it('masks addresses inside messages, string values and error text', () => {
    const { logger, lines } = capture();
    logger.error('mail to ada@example.com failed', {
      error: new Error('550 <bola@example.org>: Recipient address rejected'),
      detail: 'Key (email)=(chi@example.net) already exists',
    });
    expect(lines[0]).not.toMatch(/@example\.(com|org|net)/);
    expect(lines[0]).toContain('[email]');
  });
});
