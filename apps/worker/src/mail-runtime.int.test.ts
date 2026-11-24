import { randomBytes } from 'node:crypto';
import { schema, type Database } from '@ad/db';
import {
  asRole,
  createTestDatabase,
  integrationEnabled,
  makeAccount,
  type TestDatabase,
} from '@ad/db/testing';
import { emailHash, normalizeEmail } from '@ad/auth';
import { MemoryTransport } from '@ad/mailer';
import { enqueueEmail, sealPrefsAddress } from '@ad/queue';
import { drizzle } from 'drizzle-orm/node-postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildMailDeps } from './runtime';

const kek = new Uint8Array(randomBytes(32));
const env = {
  FIELD_KEK: kek,
  SMTP_URL: 'smtp://localhost:1',
  EMAIL_FROM: 'Angels Delight TV <no-reply@example.org>',
  SUPPORT_EMAIL: undefined,
  APP_ORIGIN: 'https://tv.example.org',
  EMAIL_HASH_PEPPER: new Uint8Array(randomBytes(32)),
};

/** The same calls the worker makes, under the real worker role so the grants are exercised. */
describe.skipIf(!integrationEnabled())('mail jobs under the worker role', () => {
  let t: TestDatabase;
  beforeAll(async () => {
    t = await createTestDatabase();
  });
  afterAll(async () => {
    await t?.drop();
  });

  it('sends a queued notice through the mailer, with the site name from settings', async () => {
    await t.db.insert(schema.settings).values({ key: 'platform.name', value: 'Grace Learning TV' });
    const transport = new MemoryTransport();
    await asRole(t.pool, 'ad_worker', {}, async (client) => {
      const db = drizzle(client, { schema }) as unknown as Database;
      await enqueueEmail(db, kek, {
        kind: 'staff_notice',
        to: 'ada@example.org',
        vars: { title: 'Encoding failed', body: 'Fractions' },
      });
      const deps = buildMailDeps(env as never, db, { transport });
      const result = await deps.drain();
      expect(result).toMatchObject({ claimed: 1, sent: 1 });
    });
    expect(transport.outbox).toHaveLength(1);
    expect(transport.outbox[0]).toMatchObject({
      to: 'ada@example.org',
      from: env.EMAIL_FROM,
      subject: 'Encoding failed',
    });
    expect(transport.outbox[0]?.text).toContain('Grace Learning TV');
    expect(transport.outbox[0]?.text).toContain('https://tv.example.org/admin');
    const [row] = await t.db.select().from(schema.emailOutbox);
    expect(row).toMatchObject({ status: 'sent', providerMessageId: 'memory-1' });
  });

  it('builds the summaries, the at once notices and the prune as the worker role', async () => {
    const person = makeAccount({ role: 'editor', status: 'active' });
    await t.db.insert(schema.accounts).values(person);
    await t.db.insert(schema.staffNotificationPrefs).values({
      accountId: person.id,
      emailFrequency: 'immediate',
      addressEnc: sealPrefsAddress(kek, person.id, 'ed@example.org'),
    });
    await t.db.insert(schema.adminNotices).values({
      recipientId: person.id,
      kind: 'encode_failed',
      title: 'Encoding failed',
      body: 'Decimals',
      createdAt: new Date(Date.now() - 60_000),
    });
    const counts = await asRole(t.pool, 'ad_worker', {}, async (client) => {
      const db = drizzle(client, { schema }) as unknown as Database;
      const deps = buildMailDeps(env as never, db, { transport: new MemoryTransport() });
      return {
        immediate: await deps.queueImmediate(),
        digests: await deps.digests(),
        pruned: await deps.prune(),
      };
    });
    expect(counts).toEqual({ immediate: 1, digests: { queued: 0, skipped: 0 }, pruned: 0 });
  });

  it('skips a viewer digest for a bounced address and sends it for a good one (M44-S15 AC2)', async () => {
    const bounced = normalizeEmail('bounced@example.org')!;
    await t.db.insert(schema.emailSuppressions).values({
      emailHash: Buffer.from(emailHash(bounced, env.EMAIL_HASH_PEPPER)).toString('hex'),
      reason: 'bounce',
    });
    const transport = new MemoryTransport();
    await asRole(t.pool, 'ad_worker', {}, async (client) => {
      const db = drizzle(client, { schema }) as unknown as Database;
      for (const to of ['bounced@example.org', 'fine@example.org'])
        await enqueueEmail(db, kek, {
          kind: 'viewer_digest_daily',
          to,
          vars: { period: 'day', lines: 'Five new videos', accountId: '0194a000-0000-7000-8000-0000000000bb' },
          dedupeKey: `digest:${to}`,
        });
      const result = await buildMailDeps(env as never, db, { transport }).drain();
      expect(result.failed).toBe(0);
    });
    const digests = transport.outbox.filter((m) => m.headers?.['List-Unsubscribe']);
    expect(digests.map((m) => m.to)).toEqual(['fine@example.org']);
    expect(digests[0]?.headers?.['List-Unsubscribe']).toContain('/unsubscribe/notices?token=');
  });
});
