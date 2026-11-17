import { schema } from '@ad/db';
import {
  createViewerTestDb,
  integrationEnabled,
  seedAccount,
  seedAsset,
  seedVideo,
  type ViewerTestDb,
} from '@ad/catalog/testing';
import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { setAdminRuntime } from '@/server/admin/runtime';
import type { AdminActor } from '../types';
import { realDashboardService } from './dashboard';
import { realSystemService } from './system';

describe.skipIf(!integrationEnabled())('real system and dashboard services', () => {
  let t: ViewerTestDb;
  let admin: AdminActor;
  let editor: AdminActor;
  const queued: Array<{ queue: string; payload: unknown; options: unknown }> = [];

  beforeAll(async () => {
    t = await createViewerTestDb();
    admin = {
      accountId: (await seedAccount(t.setup, 'admin')).id,
      role: 'admin',
      name: 'Chiamaka Okafor',
    };
    editor = {
      accountId: (await seedAccount(t.setup, 'editor')).id,
      role: 'editor',
      name: 'Ngozi Eze',
    };
    setAdminRuntime({
      db: () => t.app,
      ctx: async () => ({ db: t.app }),
      enqueue: (async (queue: string, payload: unknown, options: unknown) => {
        queued.push({ queue, payload, options });
        return { jobId: 'j', deduped: false };
      }) as never,
      names: async (_a, ids) => new Map(ids.map((id) => [id, 'Amina Bello'])),
    });
  });
  afterAll(async () => {
    setAdminRuntime(null);
    await t?.drop();
  });
  beforeEach(() => {
    queued.length = 0;
  });

  it('is admin only', async () => {
    await expect(realSystemService.jobs(editor)).rejects.toThrow();
    await expect(realSystemService.storage(editor)).rejects.toThrow();
    await expect(realSystemService.retryJob(editor, 'x')).rejects.toThrow();
  });

  it('lists failed and dead jobs with plain subjects and attempts, newest first', async () => {
    const video = await seedVideo(t.setup, { title: 'Rivers of Africa' });
    const [dead] = await t.setup
      .insert(schema.jobs)
      .values({
        queue: 'video.encode',
        videoId: video.id,
        status: 'failed_permanent',
        attempts: 4,
        errorMessage: 'The video ran out of memory while encoding.',
        errorDetail: 'ENOMEM stack',
        finishedAt: new Date('2026-06-01T10:00:00Z'),
      })
      .returning();
    const other = await seedVideo(t.setup, { title: 'Plants' });
    await t.setup.insert(schema.jobs).values({
      queue: 'caption.generate',
      videoId: other.id,
      status: 'failed',
      attempts: 1,
      errorMessage: 'The caption service did not answer.',
      finishedAt: new Date('2026-06-02T10:00:00Z'),
    });
    await t.setup
      .insert(schema.jobs)
      .values({ queue: 'video.probe', videoId: other.id, status: 'succeeded' });

    const jobs = await realSystemService.jobs(admin);
    expect(jobs.map((j) => [j.kind, j.state, j.subject])).toEqual([
      ['captions', 'failed', 'Plants'],
      ['encode', 'dead', 'Rivers of Africa'],
    ]);
    expect(jobs[1]).toMatchObject({
      id: dead!.id,
      attempts: 4,
      maxAttempts: 4,
      lastError: 'The video ran out of memory while encoding.',
      failedAt: '2026-06-01T10:00:00.000Z',
    });
    expect(JSON.stringify(jobs)).not.toContain('ENOMEM');
  });

  it('retries by queuing the same work again and clearing the old row, with an audit entry', async () => {
    const video = await seedVideo(t.setup, { title: 'Retry me' });
    const [job] = await t.setup
      .insert(schema.jobs)
      .values({
        queue: 'video.encode',
        videoId: video.id,
        status: 'failed_permanent',
        errorMessage: 'x',
      })
      .returning();
    expect(await realSystemService.retryJob(admin, job!.id)).toEqual({ ok: true });
    expect(queued).toEqual([
      {
        queue: 'video.encode',
        payload: { videoId: video.id },
        options: { createdBy: admin.accountId },
      },
    ]);
    expect((await realSystemService.jobs(admin)).some((j) => j.id === job!.id)).toBe(false);
    expect(await realSystemService.retryJob(admin, job!.id)).toEqual({
      ok: false,
      error: 'That job is already gone.',
    });
    const audit = await t.setup.execute(
      sql`select action from audit_log where target_id = ${job!.id}`,
    );
    expect(audit.rows.map((r) => r.action)).toContain('job.retry');
  });

  it('discards only with a reason, and keeps the reason in the audit log', async () => {
    const video = await seedVideo(t.setup, { title: 'Discard me' });
    const [job] = await t.setup
      .insert(schema.jobs)
      .values({
        queue: 'video.thumbnails',
        videoId: video.id,
        status: 'failed_permanent',
        errorMessage: 'x',
      })
      .returning();
    expect(await realSystemService.discardJob(admin, job!.id, ' a ')).toEqual({
      ok: false,
      error: 'Write a short reason. It is kept in the audit log.',
    });
    expect(await realSystemService.discardJob(admin, job!.id, 'Video was replaced')).toEqual({
      ok: true,
    });
    const [row] = await t.setup.select().from(schema.jobs).where(eq(schema.jobs.id, job!.id));
    expect(row?.status).toBe('cancelled');
    const audit = await t.setup.execute(
      sql`select metadata from audit_log where target_id = ${job!.id} and action = 'job.discard'`,
    );
    expect(JSON.stringify(audit.rows[0])).toContain('Video was replaced');
    expect(queued).toHaveLength(0);
  });

  it('adds up storage by type from catalog records', async () => {
    const fresh = await createViewerTestDb();
    try {
      setAdminRuntime({
        db: () => fresh.app,
        ctx: async () => ({ db: fresh.app }),
        enqueue: (async () => ({ jobId: 'j' })) as never,
        names: async () => new Map(),
      });
      const staff = {
        accountId: (await seedAccount(fresh.setup, 'admin')).id,
        role: 'admin' as const,
        name: 'A',
      };
      const video = await seedVideo(fresh.setup, {
        originalBytes: 1000,
        originalKey: 'originals/a',
      });
      await fresh.setup.insert(schema.renditions).values([
        {
          videoId: video.id,
          height: 360,
          width: 640,
          videoKbps: 800,
          audioKbps: 96,
          totalBytes: 500,
          segmentCount: 10,
          status: 'ready',
        },
        {
          videoId: video.id,
          height: 720,
          width: 1280,
          videoKbps: 2000,
          audioKbps: 128,
          totalBytes: 1500,
          segmentCount: 10,
          status: 'ready',
        },
      ]);
      await seedAsset(fresh.setup);
      const usage = await realSystemService.storage(staff);
      const byType = Object.fromEntries(usage.map((u) => [u.type, u]));
      expect(byType.video).toEqual({ type: 'video', bytes: 3000, files: 21 });
      expect(byType.poster).toMatchObject({
        type: 'poster',
        bytes: 9000 + 24000 + 52000,
        files: 3,
      });
      expect(byType.caption).toEqual({ type: 'caption', bytes: 0, files: 0 });
      expect(usage.map((u) => u.type)).toEqual(['video', 'poster', 'caption', 'other']);
    } finally {
      setAdminRuntime({
        db: () => t.app,
        ctx: async () => ({ db: t.app }),
        enqueue: (async () => ({ jobId: 'j' })) as never,
        names: async () => new Map(),
      });
      await fresh.drop();
    }
  });

  describe('dashboard', () => {
    it('counts, attention, recent and nav badges come from real videos', async () => {
      const fresh = await createViewerTestDb();
      try {
        setAdminRuntime({
          db: () => fresh.app,
          ctx: async () => ({ db: fresh.app }),
          enqueue: (async () => ({ jobId: 'j' })) as never,
          names: async (_a, ids) => new Map(ids.map((id) => [id, 'Amina Bello'])),
        });
        const staff = {
          accountId: (await seedAccount(fresh.setup, 'admin')).id,
          role: 'admin' as const,
          name: 'Chiamaka Okafor',
        };
        const empty = await realDashboardService.get(staff);
        expect(empty.isEmpty).toBe(true);

        await seedVideo(fresh.setup, { title: 'Live one' });
        await seedVideo(fresh.setup, {
          title: 'Broken',
          status: 'failed',
          publishState: 'draft',
          failureMessage: 'Damaged.',
        });
        await seedVideo(fresh.setup, { title: 'Busy', status: 'encoding', publishState: 'draft' });
        await fresh.setup
          .insert(schema.siteDailyStats)
          .values({
            day: new Date(Date.now() - 86_400_000).toISOString().slice(0, 10),
            views: 42,
            uniques: 5,
            watchMs: 1000,
          });

        const data = await realDashboardService.get(staff);
        expect(data.isEmpty).toBe(false);
        expect(data.tiles.published).toEqual({ state: 'ready', value: 1 });
        expect(data.tiles.processing).toEqual({ state: 'ready', value: 1 });
        expect(data.tiles.failed).toEqual({ state: 'ready', value: 1 });
        expect(data.attention.some((a) => a.kind === 'failed' && a.title.includes('Broken'))).toBe(
          true,
        );
        expect(data.views.state).toBe('ready');
        expect(data.views.value?.total).toBe(42);
        expect(data.storage.state).toBe('ready');
        expect(await realDashboardService.navCounts(staff)).toEqual({ encoding: 1, captions: 0 });
        expect((await realDashboardService.get({ ...staff, role: 'editor' })).storage.state).toBe(
          'forbidden',
        );
      } finally {
        setAdminRuntime(null);
        await fresh.drop();
      }
    });
  });
});
