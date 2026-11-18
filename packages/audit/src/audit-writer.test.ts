import { describe, expect, it } from 'vitest';
import { AuditWriter } from './audit-writer';
import { redact } from './redact';

interface Captured {
  rows: Array<Record<string, unknown>>;
  db: { insert: () => { values: (row: Record<string, unknown>) => Promise<void> } };
}

function capture(): Captured {
  const rows: Array<Record<string, unknown>> = [];
  return {
    rows,
    db: {
      insert: () => ({
        values: async (row) => {
          rows.push(row);
        },
      }),
    },
  };
}

describe('AuditWriter', () => {
  it('stores actor, outcome, truncated address and request id from a security event', async () => {
    const sink = capture();
    await new AuditWriter(sink.db as never).record({
      action: 'auth.login',
      outcome: 'success',
      actorAccountId: 'a1',
      actorRole: 'viewer',
      ipTrunc: '203.0.113.0/24',
      requestId: 'req-1',
      metadata: { method: 'password' },
    });
    expect(sink.rows[0]).toMatchObject({
      action: 'auth.login',
      outcome: 'success',
      actorAccountId: 'a1',
      actorRole: 'viewer',
      ipTrunc: '203.0.113.0/24',
      requestId: 'req-1',
      metadata: { method: 'password' },
    });
  });

  it('redacts metadata with the same policy as admin entries', async () => {
    const sink = capture();
    const metadata = {
      email: 'a@b.co',
      password: 'x',
      token: 't',
      passwordHash: 'h',
      reason: 'user',
      nested: { secret: 's' },
    };
    await new AuditWriter(sink.db as never).record({
      action: 'auth.password_changed',
      outcome: 'success',
      metadata,
    });
    expect(sink.rows[0]?.metadata).toEqual(redact(metadata));
    expect(JSON.stringify(sink.rows[0]?.metadata)).not.toMatch(/a@b\.co|"x"|"t"|"h"|"s"/);
    expect((sink.rows[0]?.metadata as Record<string, unknown>).reason).toBe('user');
  });

  it('drops personal data and secrets a caller put in a free text field', async () => {
    const sink = capture();
    await new AuditWriter(sink.db as never).record({
      action: 'auth.verify_email',
      outcome: 'failure',
      metadata: { note: 'tried ada@example.com' },
    });
    expect(sink.rows[0]?.metadata).toEqual({ note: 'tried [email]' });
  });

  it('never throws when the write fails and reports the error', async () => {
    const failures: unknown[] = [];
    const writer = new AuditWriter(
      { insert: () => ({ values: () => Promise.reject(new Error('down')) }) } as never,
      { onError: (error) => failures.push(error) },
    );
    await expect(
      writer.record({ action: 'auth.login', outcome: 'failure' }),
    ).resolves.toBeUndefined();
    expect(failures).toHaveLength(1);
  });

  it('reports a malformed action instead of storing it', async () => {
    const sink = capture();
    const failures: unknown[] = [];
    await new AuditWriter(sink.db as never, { onError: (e) => failures.push(e) }).record({
      action: 'NotNamespaced',
      outcome: 'success',
    });
    expect(sink.rows).toHaveLength(0);
    expect(failures).toHaveLength(1);
  });
});
