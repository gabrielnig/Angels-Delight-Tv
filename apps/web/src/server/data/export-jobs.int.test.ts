import { schema } from '@ad/db';
import {
  createHarness,
  integrationEnabled,
  NOW,
  TEST_PASSWORD,
  type ViewerHarness,
} from '@ad/viewer/testing';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { ExportJobs } from './export-jobs';

const HOUR = 3600_000;

describe.skipIf(!integrationEnabled())('data export jobs (M02-S05)', () => {
  let h: ViewerHarness;
  const clock = { now: NOW };
  const sent: Array<{ kind: string; to: string; token?: string }> = [];
  let build = vi.fn(async () => ({ exportedAt: NOW.toISOString(), account: {}, profiles: [] }));

  const jobs = () =>
    new ExportJobs(h.ctx, {
      data: {
        buildExport: (...a: unknown[]) => build(...(a as [])) as never,
        signExportToken: (accountId: string, expiresAt?: Date) =>
          `tok-${accountId}-${expiresAt?.getTime() ?? 0}`,
      },
      accountInfo: async () => ({ email: 'me@example.org', memberSince: '2026-01-01T00:00:00Z' }),
      mailer: {
        sendExportReady: async (m) => void sent.push({ kind: 'ready', to: m.to, token: m.token }),
        sendExportFailed: async (m) => void sent.push({ kind: 'failed', to: m.to }),
      },
      now: () => clock.now,
    });

  beforeAll(async () => {
    h = await createHarness();
  });
  afterAll(async () => {
    await h?.drop();
  });

  it('needs the account password and starts nothing without it', async () => {
    const u = await h.makeUser();
    const result = await jobs().request(u.accountId, 'not-the-password');
    expect(result).toEqual({ status: 'wrong_password' });
    expect(await jobs().state(u.accountId)).toEqual({ status: 'none' });
  });

  it('queues a job, builds the file in the background, mails a 24 hour link and reports ready', async () => {
    const u = await h.makeUser();
    sent.length = 0;
    const j = jobs();
    const started = await j.request(u.accountId, TEST_PASSWORD);
    expect(started.status).toBe('started');
    expect((await j.state(u.accountId)).status).toBe('pending');
    expect(await j.runPending()).toBe(1);
    const state = await j.state(u.accountId);
    expect(state).toMatchObject({ status: 'ready', fileName: 'angels-delight-data.json' });
    expect(state.downloadHref).toContain(`/api/account/export?token=tok-${u.accountId}-`);
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ kind: 'ready', to: 'me@example.org' });
    const [row] = await h.db.setup
      .select()
      .from(schema.dataExports)
      .where(eq(schema.dataExports.accountId, u.accountId));
    expect(row?.expiresAt?.getTime()).toBe(row!.readyAt!.getTime() + 24 * HOUR);
  });

  it('says the earlier export is still valid when asked again within 24 hours', async () => {
    const u = await h.makeUser();
    const j = jobs();
    await j.request(u.accountId, TEST_PASSWORD);
    await j.runPending();
    clock.now = new Date(NOW.getTime() + 23 * HOUR);
    const again = await j.request(u.accountId, TEST_PASSWORD);
    expect(again.status).toBe('already');
    const rows = await h.db.setup
      .select()
      .from(schema.dataExports)
      .where(eq(schema.dataExports.accountId, u.accountId));
    expect(rows).toHaveLength(1);
    clock.now = new Date(NOW.getTime() + 25 * HOUR);
    expect((await j.request(u.accountId, TEST_PASSWORD)).status).toBe('started');
    clock.now = NOW;
  });

  it('shows an expired export as none', async () => {
    const u = await h.makeUser();
    const j = jobs();
    await j.request(u.accountId, TEST_PASSWORD);
    await j.runPending();
    clock.now = new Date(NOW.getTime() + 25 * HOUR);
    expect((await j.state(u.accountId)).status).toBe('none');
    clock.now = NOW;
  });

  it('retries a failed build, then mails "could not build" and allows a new request', async () => {
    const u = await h.makeUser();
    sent.length = 0;
    build = vi.fn(async () => {
      throw new Error('boom');
    });
    const j = jobs();
    await j.request(u.accountId, TEST_PASSWORD);
    await j.runPending();
    expect((await j.state(u.accountId)).status).toBe('pending');
    await j.runPending();
    await j.runPending();
    expect((await j.state(u.accountId)).status).toBe('failed');
    expect(sent.filter((m) => m.kind === 'failed')).toHaveLength(1);
    build = vi.fn(async () => ({ exportedAt: NOW.toISOString(), account: {}, profiles: [] }));
    clock.now = new Date(NOW.getTime() + 60_000);
    expect((await j.request(u.accountId, TEST_PASSWORD)).status).toBe('started');
    await j.runPending();
    expect((await j.state(u.accountId)).status).toBe('ready');
    clock.now = NOW;
  });

  it('keeps accounts apart', async () => {
    const a = await h.makeUser();
    const b = await h.makeUser();
    const j = jobs();
    await j.request(a.accountId, TEST_PASSWORD);
    await j.runPending();
    expect((await j.state(b.accountId)).status).toBe('none');
  });
});
