import { randomBytes } from 'node:crypto';
import { schema, type Database } from '@ad/db';
import { asRole, createTestDatabase, integrationEnabled, type TestDatabase } from '@ad/db/testing';
import { eq, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  MAX_SEND_ATTEMPTS,
  drainOutbox,
  enqueueEmail,
  pruneOutbox,
  type OutboxMailer,
} from './outbox';
import { verifyUnsubscribeToken } from './viewer-digest';

const kek = new Uint8Array(randomBytes(32));
const T0 = new Date('2026-06-01T10:00:00Z');
const later = (seconds: number) => new Date(T0.getTime() + seconds * 1000);

interface Call {
  method: string;
  to: string;
  input: Record<string, unknown>;
}

function fakeMailer(behaviour: (call: Call, n: number) => Promise<void> | void = () => undefined) {
  const calls: Call[] = [];
  const record =
    (method: string) =>
    async (input: { to: string } & Record<string, unknown>): Promise<{ messageId: string }> => {
      const call = { method, to: input.to, input };
      calls.push(call);
      await behaviour(call, calls.length);
      return { messageId: `<msg-${calls.length}@provider>` };
    };
  const mailer: OutboxMailer = {
    sendStaffNotice: record('notice'),
    sendStaffSummary: record('summary'),
    sendStaffExportReady: record('ready'),
    sendStaffExportFailed: record('failed'),
    sendViewerDigest: record('digest'),
  };
  return { mailer, calls };
}

describe.skipIf(!integrationEnabled())('email outbox', () => {
  let t: TestDatabase;
  beforeAll(async () => {
    t = await createTestDatabase();
  });
  afterAll(async () => {
    await t?.drop();
  });
  beforeEach(async () => {
    await t.db.delete(schema.emailOutbox);
  });

  const rows = () => t.db.select().from(schema.emailOutbox).orderBy(schema.emailOutbox.createdAt);
  const queue = (n: number, extra: Record<string, unknown> = {}) =>
    enqueueEmail(t.db, kek, {
      kind: 'staff_notice',
      to: `person${n}@example.org`,
      vars: { title: `Update ${n}`, body: 'Fractions' },
      now: T0,
      ...extra,
    });

  it('stores the address sealed, never as text', async () => {
    await queue(1);
    const [row] = await rows();
    expect(row?.toEnc.toString('utf8')).not.toContain('person1@example.org');
    expect(JSON.stringify(row)).not.toContain('person1@example.org');
    expect(row?.status).toBe('queued');
  });

  it('queues one row per dedupe key, so a retried producer never mails twice', async () => {
    const first = await queue(1, { dedupeKey: 'notice:abc' });
    const second = await queue(1, { dedupeKey: 'notice:abc' });
    expect(first).toBeTruthy();
    expect(second).toBeNull();
    expect(await rows()).toHaveLength(1);
  });

  it('sends due mail, records the provider message id and marks it sent', async () => {
    await queue(1);
    const { mailer, calls } = fakeMailer();
    const result = await drainOutbox({ db: t.db, kek, mailer, now: later(5) });
    expect(result).toMatchObject({ claimed: 1, sent: 1, retried: 0, failed: 0 });
    expect(calls[0]).toMatchObject({ method: 'notice', to: 'person1@example.org' });
    expect(calls[0]?.input).toMatchObject({ title: 'Update 1', body: 'Fractions' });
    const [row] = await rows();
    expect(row).toMatchObject({
      status: 'sent',
      attempts: 1,
      providerMessageId: '<msg-1@provider>',
      lastError: null,
      lockedUntil: null,
    });
    expect(row?.sentAt).toBeInstanceOf(Date);
  });

  it('turns a stored summary back into one line per update', async () => {
    await enqueueEmail(t.db, kek, {
      kind: 'staff_summary',
      to: 'a@example.org',
      vars: { period: 'day', lines: 'One\nTwo' },
      now: T0,
    });
    const { mailer, calls } = fakeMailer();
    await drainOutbox({ db: t.db, kek, mailer, now: later(5) });
    expect(calls[0]).toMatchObject({ method: 'summary' });
    expect(calls[0]?.input).toMatchObject({ period: 'day', lines: ['One', 'Two'] });
  });

  it('leaves mail that is not due yet', async () => {
    await queue(1, { runAt: later(600) });
    const { mailer, calls } = fakeMailer();
    const result = await drainOutbox({ db: t.db, kek, mailer, now: later(5) });
    expect(result.claimed).toBe(0);
    expect(calls).toHaveLength(0);
  });

  it('sends in batches of the size asked for, oldest first', async () => {
    for (let n = 1; n <= 5; n += 1) await queue(n, { runAt: later(n) });
    const { mailer, calls } = fakeMailer();
    const first = await drainOutbox({ db: t.db, kek, mailer, now: later(60), batchSize: 2 });
    expect(first.claimed).toBe(2);
    expect(calls.map((c) => c.to)).toEqual(['person1@example.org', 'person2@example.org']);
    const rest = await drainOutbox({ db: t.db, kek, mailer, now: later(60), batchSize: 10 });
    expect(rest.claimed).toBe(3);
  });

  it('keeps a failed send for retry with a later time and no address in the error', async () => {
    await queue(1);
    const { mailer } = fakeMailer(() => {
      throw new Error('connect ETIMEDOUT while sending to person1@example.org');
    });
    const result = await drainOutbox({ db: t.db, kek, mailer, now: later(5) });
    expect(result).toMatchObject({ claimed: 1, sent: 0, retried: 1, failed: 0 });
    const [row] = await rows();
    expect(row?.status).toBe('queued');
    expect(row?.attempts).toBe(1);
    expect(row?.nextAttemptAt.getTime()).toBeGreaterThan(later(5).getTime());
    expect(row?.lastError).toContain('ETIMEDOUT');
    expect(row?.lastError).not.toContain('person1@example.org');
    // Not due again straight away, due once the wait has passed.
    const { mailer: again, calls } = fakeMailer();
    expect((await drainOutbox({ db: t.db, kek, mailer: again, now: later(10) })).claimed).toBe(0);
    expect((await drainOutbox({ db: t.db, kek, mailer: again, now: later(7200) })).sent).toBe(1);
    expect(calls).toHaveLength(1);
  });

  it('fails an SMTP 5xx rejection at once, without retrying', async () => {
    await queue(1);
    const { mailer } = fakeMailer(() => {
      throw Object.assign(new Error('mailbox unavailable'), { responseCode: 550 });
    });
    const result = await drainOutbox({ db: t.db, kek, mailer, now: later(5) });
    expect(result).toMatchObject({ failed: 1, retried: 0 });
    const [row] = await rows();
    expect(row).toMatchObject({ status: 'failed', attempts: 1 });
  });

  it('gives up after the attempt limit', async () => {
    await queue(1);
    const { mailer } = fakeMailer(() => {
      throw new Error('timeout');
    });
    let clock = 5;
    for (let n = 0; n < MAX_SEND_ATTEMPTS + 2; n += 1) {
      await drainOutbox({ db: t.db, kek, mailer, now: later(clock) });
      clock += 24 * 3600;
    }
    const [row] = await rows();
    expect(row).toMatchObject({ status: 'failed', attempts: MAX_SEND_ATTEMPTS });
  });

  it('fails a row whose address cannot be opened instead of looping on it', async () => {
    await queue(1);
    await t.db.update(schema.emailOutbox).set({ toEnc: randomBytes(40) });
    const { mailer, calls } = fakeMailer();
    const result = await drainOutbox({ db: t.db, kek, mailer, now: later(5) });
    expect(result.failed).toBe(1);
    expect(calls).toHaveLength(0);
  });

  it('never sends one row twice when two drains run at once', async () => {
    for (let n = 1; n <= 6; n += 1) await queue(n);
    const { mailer, calls } = fakeMailer(() => new Promise((r) => setTimeout(r, 30)));
    const [a, b] = await Promise.all([
      drainOutbox({ db: t.db, kek, mailer, now: later(5), batchSize: 4 }),
      drainOutbox({ db: t.db, kek, mailer, now: later(5), batchSize: 4 }),
    ]);
    expect(a.sent + b.sent).toBe(6);
    expect(new Set(calls.map((c) => c.to)).size).toBe(6);
    expect(calls).toHaveLength(6);
  });

  it('picks up a row whose worker died mid send, once its lock runs out', async () => {
    await queue(1);
    await t.db
      .update(schema.emailOutbox)
      .set({ status: 'sending', attempts: 1, lockedUntil: later(300) });
    const { mailer } = fakeMailer();
    expect((await drainOutbox({ db: t.db, kek, mailer, now: later(100) })).claimed).toBe(0);
    expect((await drainOutbox({ db: t.db, kek, mailer, now: later(400) })).sent).toBe(1);
  });

  it('fails a row that kept dying mid send past the attempt limit', async () => {
    await queue(1);
    await t.db
      .update(schema.emailOutbox)
      .set({ status: 'sending', attempts: MAX_SEND_ATTEMPTS, lockedUntil: later(300) });
    const { mailer, calls } = fakeMailer();
    await drainOutbox({ db: t.db, kek, mailer, now: later(400) });
    expect(calls).toHaveLength(0);
    expect((await rows())[0]?.status).toBe('failed');
  });

  it('prunes old sent and failed rows, and keeps recent and waiting ones', async () => {
    await queue(1);
    await queue(2);
    await queue(3);
    await queue(4);
    const all = await rows();
    const old = new Date(T0.getTime() - 120 * 24 * 3600 * 1000);
    await t.db
      .update(schema.emailOutbox)
      .set({ status: 'sent', sentAt: old, createdAt: old })
      .where(eq(schema.emailOutbox.id, all[0]!.id));
    await t.db
      .update(schema.emailOutbox)
      .set({ status: 'failed', createdAt: old })
      .where(eq(schema.emailOutbox.id, all[1]!.id));
    await t.db
      .update(schema.emailOutbox)
      .set({ status: 'sent', sentAt: T0 })
      .where(eq(schema.emailOutbox.id, all[2]!.id));
    const removed = await pruneOutbox(t.db, T0);
    expect(removed).toBe(2);
    expect((await rows()).map((r) => r.id).sort()).toEqual([all[2]!.id, all[3]!.id].sort());
  });

  it('works as the worker role', async () => {
    await queue(1);
    const { mailer } = fakeMailer();
    const result = await asRole(t.pool, 'ad_worker', {}, async (client) => {
      const db = drizzle(client) as unknown as Database;
      await enqueueEmail(db, kek, {
        kind: 'staff_notice',
        to: 'w@example.org',
        vars: { title: 'From the worker' },
        now: T0,
      });
      return drainOutbox({ db, kek, mailer, now: later(5) });
    });
    expect(result.sent).toBe(2);
    expect(
      await t.db.execute(sql`select count(*)::int as n from email_outbox where status = 'sent'`),
    ).toBeTruthy();
  });
});

describe.skipIf(!integrationEnabled())('email outbox viewer digest (M44-S15)', () => {
  let t: TestDatabase;
  beforeAll(async () => {
    t = await createTestDatabase();
  });
  afterAll(async () => {
    await t?.drop();
  });

  it('sends a stored digest with its lines and an unsubscribe token that opens for that account only', async () => {
    const account = '0194a000-0000-7000-8000-0000000000aa';
    await enqueueEmail(t.db, kek, {
      kind: 'viewer_digest_weekly',
      to: 'v@example.org',
      vars: { period: 'week', lines: 'One\nTwo', accountId: account },
      now: T0,
    });
    const { mailer, calls } = fakeMailer();
    await drainOutbox({ db: t.db, kek, mailer, now: later(5) });
    expect(calls[0]).toMatchObject({ method: 'digest', to: 'v@example.org' });
    expect(calls[0]?.input).toMatchObject({ period: 'week', lines: ['One', 'Two'] });
    expect(verifyUnsubscribeToken(kek, String(calls[0]?.input.unsubscribeToken), later(5))).toBe(account);
  });
});
