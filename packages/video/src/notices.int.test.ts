import { schema } from '@ad/db';
import {
  createTestDatabase,
  integrationEnabled,
  makeAccount,
  type TestDatabase,
} from '@ad/db/testing';
import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { notifyStaff } from './notices';

describe.skipIf(!integrationEnabled())('notifyStaff', () => {
  let t: TestDatabase;
  const ids: Record<string, string> = {};

  beforeAll(async () => {
    t = await createTestDatabase();
    for (const [name, role, status] of [
      ['editor', 'editor', 'active'],
      ['admin', 'admin', 'active'],
      ['viewer', 'viewer', 'active'],
    ] as const) {
      const row = makeAccount({ role, status });
      await t.db.insert(schema.accounts).values(row);
      ids[name] = row.id;
    }
  });
  afterAll(async () => {
    await t?.drop();
  });

  const all = () => t.db.select().from(schema.adminNotices);

  it('gives every active editor and admin their own unread notice, and nobody else', async () => {
    const sent = await notifyStaff(t.db, {
      kind: 'captions_ready',
      title: 'Captions ready to review',
      body: 'Fractions',
      href: '/admin/videos/x/captions',
    });
    expect(sent).toBe(2);
    const rows = await all();
    expect(rows.map((r) => r.recipientId).sort()).toEqual([ids.editor, ids.admin].sort());
    expect(rows.every((r) => r.readAt === null && r.title === 'Captions ready to review')).toBe(
      true,
    );
  });

  it('skips suspended staff', async () => {
    const row = makeAccount({ role: 'editor' });
    await t.db.insert(schema.accounts).values({ ...row, status: 'suspended' });
    const before = (await all()).length;
    await notifyStaff(t.db, { kind: 'encode_done', title: 'Ready' });
    const rows = await all();
    expect(rows.length - before).toBe(2);
    expect(rows.some((r) => r.recipientId === row.id)).toBe(false);
  });

  it('drops notices past the keep window when it writes a new one', async () => {
    await t.db
      .update(schema.adminNotices)
      .set({ createdAt: sql`now() - interval '120 days'` })
      .where(eq(schema.adminNotices.kind, 'captions_ready'));
    await notifyStaff(t.db, { kind: 'encode_failed', title: 'Encoding failed' });
    expect((await all()).some((r) => r.kind === 'captions_ready')).toBe(false);
  });

  it('never throws, and reports the error, so a notice cannot fail a job', async () => {
    const onError = vi.fn();
    const broken = { execute: async () => Promise.reject(new Error('db down')) } as never;
    await expect(notifyStaff(broken, { kind: 'encode_done', title: 'x' }, onError)).resolves.toBe(
      0,
    );
    expect(onError).toHaveBeenCalledOnce();
  });
});
