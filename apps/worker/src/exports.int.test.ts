import { randomBytes } from 'node:crypto';
import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { schema, type Database } from '@ad/db';
import {
  asRole,
  createTestDatabase,
  integrationEnabled,
  makeAccount,
  makeVideo,
  type TestDatabase,
} from '@ad/db/testing';
import { openAddress, sealPrefsAddress } from '@ad/queue';
import { createLogger } from '@ad/shared';
import { LocalStorage } from '@ad/storage';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { EXPORT_KEEP_HOURS, cleanupExports, exportKey, generateExport } from './exports';

const kek = new Uint8Array(randomBytes(32));
const NOW = new Date('2026-06-10T10:00:00Z');
const logger = createLogger({ write: () => undefined });

describe.skipIf(!integrationEnabled())('background exports (M19-S05, M20-S03)', () => {
  let t: TestDatabase;
  let storage: LocalStorage;
  let requester: string;
  let videoId: string;

  const runtime = (over: Record<string, unknown> = {}) => ({
    db: t.db,
    storage,
    kek,
    logger,
    now: () => NOW,
    pageSize: 10,
    ...over,
  });

  async function ask(
    kind: 'audit' | 'analytics',
    params: Record<string, string>,
    scope: 'all' | 'content' = 'all',
    by = requester,
  ) {
    const [row] = await t.db
      .insert(schema.staffExports)
      .values({ requesterId: by, kind, params, scope })
      .returning();
    return row!;
  }
  const read = (id: string) => readFileSync(join(storage_root, 'originals', exportKey(id)), 'utf8');
  let storage_root: string;
  const exportRow = async (id: string) =>
    (await t.db.select().from(schema.staffExports).where(eq(schema.staffExports.id, id)))[0]!;
  const outbox = () => t.db.select().from(schema.emailOutbox);

  beforeAll(async () => {
    t = await createTestDatabase();
    storage_root = mkdtempSync(join(tmpdir(), 'ad-exports-'));
    storage = new LocalStorage({
      root: storage_root,
      bucket: 'originals',
      signingSecret: new Uint8Array(32),
    });
    const me = makeAccount({ role: 'super_admin', status: 'active' });
    await t.db.insert(schema.accounts).values(me);
    requester = me.id;
    await t.db.insert(schema.staffNotificationPrefs).values({
      accountId: me.id,
      addressEnc: sealPrefsAddress(kek, me.id, 'boss@example.org'),
    });
    const rows = [];
    for (let i = 1; i <= 25; i += 1) {
      rows.push({
        action: i % 5 === 0 ? 'auth.login.failed' : 'video.edit',
        outcome: 'success' as const,
        targetId: `t${i}`,
        metadata: { summary: i === 1 ? '=HYPERLINK("x")' : `Edit ${i}` },
      });
    }
    await t.db.insert(schema.auditLog).values(rows);
    const video = makeVideo({ status: 'ready', title: 'Fractions, part 1', durationMs: 60_000 });
    await t.db.insert(schema.videos).values(video);
    videoId = video.id;
    await t.db.insert(schema.videoDailyStats).values([
      { videoId, day: '2026-01-20', views: 4, watchMs: 120_000, completions: 1 },
      { videoId, day: '2026-02-03', views: 2, watchMs: 30_000, completions: 0 },
      { videoId, day: '2026-03-09', views: 7, watchMs: 700_000, completions: 3 },
    ]);
  });
  afterAll(async () => {
    await t?.drop();
  });

  it('builds the whole audit log past the screen limit and the old 5000 cap, then marks it ready', async () => {
    const row = await ask('audit', {});
    expect(await generateExport(runtime(), row.id, { finalAttempt: true })).toBe('built');
    const lines = read(row.id).trimEnd().split('\n');
    expect(lines[0]).toBe(
      'id,occurred_at,actor_account_id,actor_role,action,outcome,target_type,target_id,ip,request_id,summary',
    );
    expect(lines).toHaveLength(26);
    const done = await exportRow(row.id);
    expect(done).toMatchObject({
      status: 'ready',
      rowCount: 25,
      fileKey: exportKey(row.id),
      error: null,
    });
    expect(done.bytes).toBe(Buffer.byteLength(read(row.id)));
    expect(done.expiresAt!.getTime()).toBe(NOW.getTime() + EXPORT_KEEP_HOURS * 3_600_000);
  });

  it('neutralises formulas in the file', async () => {
    const row = await ask('audit', { target: 't1' });
    await generateExport(runtime(), row.id, { finalAttempt: true });
    expect(read(row.id)).toContain(`'=HYPERLINK`);
  });

  it('keeps an Admin export to content actions, because the scope was fixed when it was asked for', async () => {
    const row = await ask('audit', { action: 'auth.' }, 'content');
    await generateExport(runtime(), row.id, { finalAttempt: true });
    expect(read(row.id).trimEnd().split('\n')).toHaveLength(1);
    expect((await exportRow(row.id)).rowCount).toBe(0);
    const all = await ask('audit', {}, 'content');
    await generateExport(runtime(), all.id, { finalAttempt: true });
    expect((await exportRow(all.id)).rowCount).toBe(20);
  });

  it('applies the filters that were stored with it', async () => {
    const row = await ask('audit', { action: 'auth.login.failed' });
    await generateExport(runtime(), row.id, { finalAttempt: true });
    expect((await exportRow(row.id)).rowCount).toBe(5);
  });

  it('builds the analytics export one month at a time, in day order', async () => {
    const row = await ask('analytics', { from: '2026-01-01', to: '2026-03-31' });
    await generateExport(runtime(), row.id, { finalAttempt: true });
    expect(read(row.id)).toBe(
      [
        'day,video_id,title,archived,views,watch_seconds,completions',
        `2026-01-20,${videoId},"Fractions, part 1",no,4,120,1`,
        `2026-02-03,${videoId},"Fractions, part 1",no,2,30,0`,
        `2026-03-09,${videoId},"Fractions, part 1",no,7,700,3`,
        '',
      ].join('\n'),
    );
    expect((await exportRow(row.id)).rowCount).toBe(3);
  });

  it('queues one email to the requester with the file name and the row count, from the sealed address', async () => {
    const row = await ask('audit', { target: 't2' });
    await generateExport(runtime(), row.id, { finalAttempt: true });
    const mails = (await outbox()).filter((m) => m.dedupeKey === `export:${row.id}`);
    expect(mails).toHaveLength(1);
    expect(mails[0]).toMatchObject({ kind: 'staff_export_ready', recipientId: requester });
    expect(mails[0]!.vars).toMatchObject({ name: 'Audit log', rows: 1, hours: EXPORT_KEEP_HOURS });
    expect(openAddress(kek, `outbox:${mails[0]!.id}`, mails[0]!.toEnc)).toBe('boss@example.org');
  });

  it('still finishes when the requester has no saved address, and says so in the log only', async () => {
    const lone = makeAccount({ role: 'super_admin', status: 'active' });
    await t.db.insert(schema.accounts).values(lone);
    const row = await ask('audit', { target: 't3' }, 'all', lone.id);
    await generateExport(runtime(), row.id, { finalAttempt: true });
    expect((await exportRow(row.id)).status).toBe('ready');
    expect((await outbox()).some((m) => m.dedupeKey === `export:${row.id}`)).toBe(false);
  });

  it('does nothing for an export that is ready or missing, so a retried job never builds twice', async () => {
    const row = await ask('audit', { target: 't4' });
    await generateExport(runtime(), row.id, { finalAttempt: true });
    const before = await exportRow(row.id);
    expect(await generateExport(runtime(), row.id, { finalAttempt: true })).toBe('skipped');
    expect(await exportRow(row.id)).toEqual(before);
    expect(
      await generateExport(runtime(), '0192f0a0-0000-7000-8000-00000000dead', {
        finalAttempt: true,
      }),
    ).toBe('skipped');
  });

  it('puts the export back in the queue on a failed attempt that will be retried', async () => {
    const row = await ask('audit', {});
    const broken = Object.assign(Object.create(storage), {
      put: async () => {
        throw new Error('disk full');
      },
    }) as LocalStorage;
    await expect(
      generateExport(runtime({ storage: broken }), row.id, { finalAttempt: false }),
    ).rejects.toThrow('disk full');
    expect((await exportRow(row.id)).status).toBe('queued');
    expect((await outbox()).some((m) => m.dedupeKey === `export:${row.id}`)).toBe(false);
  });

  it('fails it for good on the last attempt, with a plain reason and a failure email', async () => {
    const row = await ask('audit', {});
    const broken = Object.assign(Object.create(storage), {
      put: async () => {
        throw new Error('disk full at /var/secret/path for boss@example.org');
      },
    }) as LocalStorage;
    expect(await generateExport(runtime({ storage: broken }), row.id, { finalAttempt: true })).toBe(
      'failed',
    );
    const failed = await exportRow(row.id);
    expect(failed.status).toBe('failed');
    expect(failed.error).not.toContain('/var/secret');
    expect(failed.error).not.toContain('boss@example.org');
    const mail = (await outbox()).find((m) => m.dedupeKey === `export:${row.id}`);
    expect(mail).toMatchObject({ kind: 'staff_export_failed' });
  });

  it('refuses to build more rows than the ceiling and says how to narrow it', async () => {
    const row = await ask('audit', {});
    expect(await generateExport(runtime({ maxRows: 5 }), row.id, { finalAttempt: true })).toBe(
      'failed',
    );
    const failed = await exportRow(row.id);
    expect(failed.error).toMatch(/narrow/i);
    expect(existsSync(join(storage_root, 'originals', exportKey(row.id)))).toBe(false);
  });

  it('deletes expired files and rows, and old failed rows, and keeps the rest', async () => {
    const fresh = await ask('audit', { target: 't5' });
    const stale = await ask('audit', { target: 't6' });
    const dead = await ask('audit', { target: 't7' });
    for (const r of [fresh, stale]) await generateExport(runtime(), r.id, { finalAttempt: true });
    await t.db
      .update(schema.staffExports)
      .set({ expiresAt: new Date(NOW.getTime() - 1000) })
      .where(eq(schema.staffExports.id, stale.id));
    await t.db
      .update(schema.staffExports)
      .set({ status: 'failed', createdAt: new Date(NOW.getTime() - 8 * 86_400_000) })
      .where(eq(schema.staffExports.id, dead.id));
    const removed = await cleanupExports(runtime());
    expect(removed).toBeGreaterThanOrEqual(2);
    const ids = (await t.db.select({ id: schema.staffExports.id }).from(schema.staffExports)).map(
      (r) => r.id,
    );
    expect(ids).toContain(fresh.id);
    expect(ids).not.toContain(stale.id);
    expect(ids).not.toContain(dead.id);
    expect(existsSync(join(storage_root, 'originals', exportKey(stale.id)))).toBe(false);
    expect(existsSync(join(storage_root, 'originals', exportKey(fresh.id)))).toBe(true);
  });

  it('runs as the worker role: reads the audit log, updates exports, writes the outbox', async () => {
    const row = await ask('audit', { target: 't8' });
    const built = await asRole(t.pool, 'ad_worker', {}, async (client) => {
      const db = drizzle(client, { schema }) as unknown as Database;
      return generateExport(runtime({ db }), row.id, { finalAttempt: true });
    });
    expect(built).toBe('built');
    expect((await exportRow(row.id)).status).toBe('ready');
  });
});
