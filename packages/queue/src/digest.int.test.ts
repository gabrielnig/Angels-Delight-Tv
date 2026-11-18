import { randomBytes } from 'node:crypto';
import { schema, type Database } from '@ad/db';
import {
  asRole,
  createTestDatabase,
  integrationEnabled,
  makeAccount,
  type TestDatabase,
} from '@ad/db/testing';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  buildDigests,
  isDailySummaryHour,
  queueImmediateNotices,
  sealPrefsAddress,
} from './digest';
import { openAddress } from './outbox';

const kek = new Uint8Array(randomBytes(32));
const HOURLY = new Date('2026-06-01T10:05:00Z');
// 06:05 UTC is 07:05 in Lagos, when the daily summary goes out.
const MORNING = new Date('2026-06-02T06:05:00Z');
const minutesBefore = (at: Date, minutes: number) => new Date(at.getTime() - minutes * 60_000);

describe('daily summary hour', () => {
  it('is 07:00 in Lagos, not 07:00 UTC', () => {
    expect(isDailySummaryHour(new Date('2026-06-02T06:05:00Z'))).toBe(true);
    expect(isDailySummaryHour(new Date('2026-06-02T07:05:00Z'))).toBe(false);
    expect(isDailySummaryHour(new Date('2026-06-02T05:59:00Z'))).toBe(false);
  });
});

describe.skipIf(!integrationEnabled())('notification emails', () => {
  let t: TestDatabase;
  beforeAll(async () => {
    t = await createTestDatabase();
  });
  afterAll(async () => {
    await t?.drop();
  });
  beforeEach(async () => {
    await t.db.delete(schema.emailOutbox);
    await t.db.delete(schema.adminNotices);
    await t.db.delete(schema.staffNotificationPrefs);
  });

  async function person(
    address: string | null,
    prefs: Partial<typeof schema.staffNotificationPrefs.$inferInsert> = {},
  ) {
    const row = makeAccount({ role: 'editor', status: 'active' });
    await t.db.insert(schema.accounts).values(row);
    await t.db.insert(schema.staffNotificationPrefs).values({
      accountId: row.id,
      failures: true,
      captionsReady: false,
      dailySummary: false,
      emailFrequency: 'hourly',
      addressEnc: address ? sealPrefsAddress(kek, row.id, address) : null,
      ...prefs,
    });
    return row.id;
  }

  async function notice(
    recipientId: string,
    kind: 'encode_done' | 'encode_failed' | 'captions_ready' | 'captions_failed',
    title: string,
    at: Date,
    body = '',
  ) {
    const [row] = await t.db
      .insert(schema.adminNotices)
      .values({ recipientId, kind, title, body, createdAt: at })
      .returning();
    return row!;
  }

  const outbox = () => t.db.select().from(schema.emailOutbox).orderBy(schema.emailOutbox.createdAt);
  const addressOf = (row: typeof schema.emailOutbox.$inferSelect) =>
    openAddress(kek, `outbox:${row.id}`, row.toEnc);
  const emailed = async (id: string) =>
    (await t.db.select().from(schema.adminNotices).where(eq(schema.adminNotices.id, id)))[0]
      ?.emailedAt;

  describe('immediate', () => {
    it('queues one email per eligible notice, and marks it so it is never queued twice', async () => {
      const id = await person('ada@example.org', { emailFrequency: 'immediate' });
      const failed = await notice(
        id,
        'encode_failed',
        'Encoding failed',
        minutesBefore(HOURLY, 2),
        'Fractions',
      );
      const ready = await notice(id, 'captions_ready', 'Captions ready', minutesBefore(HOURLY, 2));
      const done = await notice(id, 'encode_done', 'Video is ready', minutesBefore(HOURLY, 2));
      expect(await queueImmediateNotices({ db: t.db, kek, now: HOURLY })).toBe(1);
      const [row] = await outbox();
      expect(row).toMatchObject({ kind: 'staff_notice', recipientId: id, status: 'queued' });
      expect(row?.vars).toMatchObject({ title: 'Encoding failed', body: 'Fractions' });
      expect(addressOf(row!)).toBe('ada@example.org');
      expect(await emailed(failed.id)).toBeTruthy();
      expect(await emailed(ready.id)).toBeFalsy();
      expect(await emailed(done.id)).toBeFalsy();
      expect(await queueImmediateNotices({ db: t.db, kek, now: HOURLY })).toBe(0);
    });

    it('follows the preference: captions ready only when asked for, failures only when not turned off', async () => {
      const wantsReady = await person('a@example.org', {
        emailFrequency: 'immediate',
        failures: false,
        captionsReady: true,
      });
      await notice(wantsReady, 'captions_ready', 'Captions ready', minutesBefore(HOURLY, 1));
      await notice(
        wantsReady,
        'captions_failed',
        'Captions could not be made',
        minutesBefore(HOURLY, 1),
      );
      expect(await queueImmediateNotices({ db: t.db, kek, now: HOURLY })).toBe(1);
      expect((await outbox())[0]?.vars).toMatchObject({ title: 'Captions ready' });
    });

    it('leaves hourly and daily people to the summaries', async () => {
      const id = await person('b@example.org', { emailFrequency: 'hourly' });
      await notice(id, 'encode_failed', 'Encoding failed', minutesBefore(HOURLY, 1));
      expect(await queueImmediateNotices({ db: t.db, kek, now: HOURLY })).toBe(0);
    });
  });

  describe('summaries', () => {
    it("bundles an hourly person's pending notices into one email and marks them", async () => {
      const id = await person('h@example.org');
      const a = await notice(
        id,
        'encode_failed',
        'Encoding failed',
        minutesBefore(HOURLY, 40),
        'Fractions',
      );
      const b = await notice(
        id,
        'captions_failed',
        'Captions could not be made',
        minutesBefore(HOURLY, 10),
        'Decimals',
      );
      const result = await buildDigests({ db: t.db, kek, now: HOURLY });
      expect(result).toMatchObject({ queued: 1, skipped: 0 });
      const [row] = await outbox();
      expect(row).toMatchObject({ kind: 'staff_summary', recipientId: id });
      expect(row?.vars).toMatchObject({ period: 'hour' });
      expect(String(row?.vars.lines).split('\n')).toEqual([
        'Encoding failed: Fractions',
        'Captions could not be made: Decimals',
      ]);
      expect(await emailed(a.id)).toBeTruthy();
      expect(await emailed(b.id)).toBeTruthy();
      expect((await buildDigests({ db: t.db, kek, now: HOURLY })).queued).toBe(0);
    });

    it('sends nothing to a person with nothing new', async () => {
      await person('quiet@example.org');
      expect((await buildDigests({ db: t.db, kek, now: HOURLY })).queued).toBe(0);
      expect(await outbox()).toHaveLength(0);
    });

    it("holds a daily person's notices until 07:00 in Lagos, then sends one summary", async () => {
      const id = await person('d@example.org', { emailFrequency: 'daily' });
      const n = await notice(
        id,
        'encode_failed',
        'Encoding failed',
        minutesBefore(HOURLY, 5),
        'Fractions',
      );
      expect((await buildDigests({ db: t.db, kek, now: HOURLY })).queued).toBe(0);
      expect(await emailed(n.id)).toBeFalsy();
      expect((await buildDigests({ db: t.db, kek, now: MORNING })).queued).toBe(1);
      const [row] = await outbox();
      expect(row?.vars).toMatchObject({ period: 'day' });
      expect(await emailed(n.id)).toBeTruthy();
    });

    it('adds the daily summary for people who asked for it, covering the last 24 hours of every kind', async () => {
      const id = await person('s@example.org', { failures: false, dailySummary: true });
      await notice(id, 'encode_done', 'Video is ready', minutesBefore(MORNING, 600), 'Shapes');
      await notice(id, 'captions_ready', 'Captions ready', minutesBefore(MORNING, 300), 'Shapes');
      await notice(id, 'encode_done', 'Video is ready', minutesBefore(MORNING, 60 * 40), 'Too old');
      expect((await buildDigests({ db: t.db, kek, now: HOURLY })).queued).toBe(0);
      expect((await buildDigests({ db: t.db, kek, now: MORNING })).queued).toBe(1);
      const [row] = await outbox();
      expect(String(row?.vars.lines).split('\n')).toEqual([
        'Video is ready: Shapes',
        'Captions ready: Shapes',
      ]);
    });

    it('sends one email, not two, to a daily person who also wants the daily summary', async () => {
      const id = await person('both@example.org', { emailFrequency: 'daily', dailySummary: true });
      await notice(id, 'encode_failed', 'Encoding failed', minutesBefore(MORNING, 120));
      await buildDigests({ db: t.db, kek, now: MORNING });
      expect(await outbox()).toHaveLength(1);
    });

    it('caps a long summary and says how many more there were', async () => {
      const id = await person('busy@example.org');
      for (let n = 0; n < 60; n += 1) {
        await notice(id, 'encode_failed', `Failed ${n}`, minutesBefore(HOURLY, 50 - n / 2));
      }
      await buildDigests({ db: t.db, kek, now: HOURLY });
      const lines = String((await outbox())[0]?.vars.lines).split('\n');
      expect(lines).toHaveLength(51);
      expect(lines.at(-1)).toBe('and 10 more');
    });

    it('skips people with no stored address and leaves their notices for later', async () => {
      const id = await person(null);
      const n = await notice(id, 'encode_failed', 'Encoding failed', minutesBefore(HOURLY, 5));
      const result = await buildDigests({ db: t.db, kek, now: HOURLY });
      expect(result).toMatchObject({ queued: 0, skipped: 1 });
      expect(await emailed(n.id)).toBeFalsy();
    });

    it('ignores notices older than a week', async () => {
      const id = await person('old@example.org');
      await notice(
        id,
        'encode_failed',
        'Encoding failed',
        new Date(HOURLY.getTime() - 8 * 86_400_000),
      );
      expect((await buildDigests({ db: t.db, kek, now: HOURLY })).queued).toBe(0);
    });
  });

  it('runs as the worker role, which cannot read accounts', async () => {
    const id = await person('w@example.org', { emailFrequency: 'immediate' });
    await notice(id, 'encode_failed', 'Encoding failed', minutesBefore(HOURLY, 1));
    const hourly = await person('x@example.org');
    await notice(hourly, 'captions_failed', 'Captions could not be made', minutesBefore(HOURLY, 1));
    const counts = await asRole(t.pool, 'ad_worker', {}, async (client) => {
      const db = drizzle(client) as unknown as Database;
      return {
        immediate: await queueImmediateNotices({ db, kek, now: HOURLY }),
        digest: (await buildDigests({ db, kek, now: HOURLY })).queued,
      };
    });
    expect(counts).toEqual({ immediate: 1, digest: 1 });
  });
});
