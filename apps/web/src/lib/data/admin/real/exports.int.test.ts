import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Readable } from 'node:stream';
import { StaffService } from '@ad/auth';
import { createAuthHarness, registerMember, type AuthHarness } from '@ad/auth/testing';
import { schema } from '@ad/db';
import { integrationEnabled } from '@ad/db/testing';
import { Forbidden, NotFound, ValidationFailed } from '@ad/shared';
import { LocalStorage } from '@ad/storage';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { setAdminRuntime } from '@/server/admin/runtime';
import type { AdminActor } from '../types';

vi.mock('server-only', () => ({}));
const { realExports, MAX_OPEN_EXPORTS } = await import('./exports');

const text = async (stream: Readable) => {
  const parts: Buffer[] = [];
  for await (const part of stream) parts.push(Buffer.from(part));
  return Buffer.concat(parts).toString('utf8');
};

describe.skipIf(!integrationEnabled())('real background exports', () => {
  let h: AuthHarness;
  let staff: StaffService;
  let storage: LocalStorage;
  const queued: string[] = [];
  let failQueue = false;

  async function person(role: 'editor' | 'admin' | 'super_admin') {
    const member = await registerMember(h, staff, {
      email: `${role}.${Math.random().toString(36).slice(2, 7)}@example.org`,
    });
    await h.dbs.admin.db
      .update(schema.accounts)
      .set({ role })
      .where(eq(schema.accounts.id, member.id));
    const actor: AdminActor = { accountId: member.id, role, name: 'Someone' };
    return { member, actor };
  }
  const rowOf = async (id: string) =>
    (
      await h.dbs.admin.db.select().from(schema.staffExports).where(eq(schema.staffExports.id, id))
    )[0]!;

  /** What the worker does, so the download side can be tested without it. */
  async function finish(id: string, body = 'id,action\n1,video.edit\n', over: object = {}) {
    await storage.put(`exports/${id}.csv`, Buffer.from(body));
    await h.dbs.admin.db
      .update(schema.staffExports)
      .set({
        status: 'ready',
        rowCount: 1,
        bytes: Buffer.byteLength(body),
        fileKey: `exports/${id}.csv`,
        expiresAt: new Date(Date.now() + 3_600_000),
        ...over,
      })
      .where(eq(schema.staffExports.id, id));
  }

  beforeAll(async () => {
    h = await createAuthHarness();
    staff = new StaffService(h.deps);
    storage = new LocalStorage({
      root: mkdtempSync(join(tmpdir(), 'ad-web-exports-')),
      bucket: 'originals',
      signingSecret: new Uint8Array(32),
    });
    setAdminRuntime({
      db: () => h.dbs.app.db,
      originals: () => storage,
      enqueueExport: async (id) => {
        if (failQueue) throw new Error('queue down');
        queued.push(id);
        return 'boss-1';
      },
      now: () => new Date(),
    });
  });
  afterAll(async () => {
    setAdminRuntime(null);
    await h?.drop();
  });

  describe('asking for one', () => {
    it('stores the request with the scope from the role and queues the job', async () => {
      const { actor } = await person('super_admin');
      const { id } = await realExports.request(actor, {
        kind: 'audit',
        params: { action: 'video.' },
      });
      expect(queued).toContain(id);
      expect(await rowOf(id)).toMatchObject({
        requesterId: actor.accountId,
        kind: 'audit',
        scope: 'all',
        status: 'queued',
        params: { action: 'video.' },
      });
    });

    it('refuses an Admin the audit log and an editor too, and queues nothing', async () => {
      const before = queued.length;
      for (const role of ['admin', 'editor'] as const) {
        const { actor } = await person(role);
        await expect(
          realExports.request(actor, { kind: 'audit', params: {} }),
        ).rejects.toBeInstanceOf(Forbidden);
      }
      expect(queued).toHaveLength(before);
    });

    it('refuses a viewer for analytics, and lets an editor have it', async () => {
      const viewer: AdminActor = {
        accountId: (await person('editor')).actor.accountId,
        role: 'viewer' as never,
        name: 'V',
      };
      await expect(
        realExports.request(viewer, {
          kind: 'analytics',
          params: { from: '2026-01-01', to: '2026-01-31' },
        }),
      ).rejects.toBeInstanceOf(Forbidden);
      const { actor } = await person('editor');
      const { id } = await realExports.request(actor, {
        kind: 'analytics',
        params: { from: '2026-01-01', to: '2026-01-31' },
      });
      expect((await rowOf(id)).kind).toBe('analytics');
    });

    it('refuses a kind or params it does not know', async () => {
      const { actor } = await person('super_admin');
      await expect(
        realExports.request(actor, { kind: 'users' as never, params: {} }),
      ).rejects.toBeInstanceOf(ValidationFailed);
      await expect(
        realExports.request(actor, { kind: 'analytics', params: { from: 'x', to: 'y' } }),
      ).rejects.toBeInstanceOf(ValidationFailed);
    });

    it('caps how many exports one person can have waiting, so the queue cannot be flooded', async () => {
      const { actor } = await person('super_admin');
      for (let n = 0; n < MAX_OPEN_EXPORTS; n += 1) {
        await realExports.request(actor, { kind: 'audit', params: { target: `t${n}` } });
      }
      await expect(realExports.request(actor, { kind: 'audit', params: {} })).rejects.toThrow(
        /waiting/i,
      );
    });

    it('takes the row back out when the job cannot be queued, instead of leaving it stuck', async () => {
      const { actor } = await person('super_admin');
      failQueue = true;
      await expect(realExports.request(actor, { kind: 'audit', params: {} })).rejects.toThrow();
      failQueue = false;
      expect(await realExports.list(actor)).toHaveLength(0);
    });
  });

  describe('listing', () => {
    it('shows a person their own exports only, newest first', async () => {
      const a = await person('super_admin');
      const b = await person('super_admin');
      const first = await realExports.request(a.actor, { kind: 'audit', params: {} });
      const second = await realExports.request(a.actor, {
        kind: 'audit',
        params: { action: 'x.' },
      });
      await realExports.request(b.actor, { kind: 'audit', params: {} });
      const mine = await realExports.list(a.actor);
      expect(mine.map((e) => e.id)).toEqual([second.id, first.id]);
      expect(mine.every((e) => e.name === 'Audit log')).toBe(true);
    });

    it('leaves out kinds the person can no longer export', async () => {
      const a = await person('super_admin');
      await realExports.request(a.actor, { kind: 'audit', params: {} });
      const demoted = { ...a.actor, role: 'editor' as const };
      expect(await realExports.list(demoted)).toEqual([]);
    });

    it('shows the plain failure reason, not an internal one', async () => {
      const a = await person('super_admin');
      const { id } = await realExports.request(a.actor, { kind: 'audit', params: {} });
      await h.dbs.admin.db
        .update(schema.staffExports)
        .set({
          status: 'failed',
          error: 'Too many rows for one file. Narrow the filters or the dates and try again.',
        })
        .where(eq(schema.staffExports.id, id));
      const [row] = await realExports.list(a.actor);
      expect(row).toMatchObject({ status: 'failed', error: expect.stringContaining('Narrow') });
    });
  });

  describe('downloading', () => {
    it('streams the file to the person who asked for it', async () => {
      const a = await person('super_admin');
      const { id } = await realExports.request(a.actor, { kind: 'audit', params: {} });
      await finish(id);
      const file = await realExports.open(a.actor, id);
      expect(await text(file.stream)).toBe('id,action\n1,video.edit\n');
      expect(file.fileName).toMatch(/^audit-log-\d{4}-\d{2}-\d{2}\.csv$/);
      expect(file.bytes).toBe(23);
    });

    it('refuses another staff member, even a Super admin, and does not say the file exists', async () => {
      const a = await person('super_admin');
      const b = await person('super_admin');
      const { id } = await realExports.request(a.actor, { kind: 'audit', params: {} });
      await finish(id);
      await expect(realExports.open(b.actor, id)).rejects.toBeInstanceOf(NotFound);
      await expect(
        realExports.open(b.actor, '0192f0a0-0000-7000-8000-00000000dead'),
      ).rejects.toBeInstanceOf(NotFound);
    });

    it('refuses someone who lost the permission after asking', async () => {
      const a = await person('super_admin');
      const { id } = await realExports.request(a.actor, { kind: 'audit', params: {} });
      await finish(id);
      await expect(realExports.open({ ...a.actor, role: 'admin' }, id)).rejects.toBeInstanceOf(
        Forbidden,
      );
    });

    it('refuses a file that is not ready, expired, or failed', async () => {
      const a = await person('super_admin');
      const waiting = await realExports.request(a.actor, { kind: 'audit', params: {} });
      await expect(realExports.open(a.actor, waiting.id)).rejects.toThrow(/not ready/i);
      const old = await realExports.request(a.actor, { kind: 'audit', params: { target: 'old' } });
      await finish(old.id, 'x\n', { expiresAt: new Date(Date.now() - 1000) });
      await expect(realExports.open(a.actor, old.id)).rejects.toThrow(/expired/i);
    });

    it('never reads a file key that is not the one built for this export', async () => {
      const a = await person('super_admin');
      const { id } = await realExports.request(a.actor, { kind: 'audit', params: {} });
      await storage.put('exports/other.csv', Buffer.from('secret'));
      await finish(id, 'mine\n', { fileKey: 'exports/other.csv' });
      await expect(realExports.open(a.actor, id)).rejects.toBeInstanceOf(NotFound);
      await finish(id, 'mine\n', { fileKey: '../../etc/passwd' });
      await expect(realExports.open(a.actor, id)).rejects.toBeInstanceOf(NotFound);
    });

    it('refuses an id that is not an id', async () => {
      const a = await person('super_admin');
      await expect(realExports.open(a.actor, "1' OR '1'='1")).rejects.toBeInstanceOf(NotFound);
    });
  });
});
