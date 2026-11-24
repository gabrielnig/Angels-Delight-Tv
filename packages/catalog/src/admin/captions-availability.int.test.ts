import { eq, sql } from 'drizzle-orm';
import { videos } from '@ad/db';
import { uuidv7, type Actor } from '@ad/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createViewerTestDb, integrationEnabled, seedAccount, seedVideo, type ViewerTestDb } from '../testing';
import { setCaptionsAvailability, setCaptionsAvailabilityMany } from './captions-availability';
import type { AdminContext } from './types';

describe.skipIf(!integrationEnabled())('captions availability', () => {
  let t: ViewerTestDb;
  let ctx: AdminContext;
  let editor: Actor;
  let admin: Actor;

  beforeAll(async () => {
    t = await createViewerTestDb();
    ctx = { db: t.app };
    editor = { accountId: (await seedAccount(t.setup, 'editor')).id, role: 'editor' };
    admin = { accountId: (await seedAccount(t.setup, 'admin')).id, role: 'admin' };
  });
  afterAll(async () => {
    await t?.drop();
  });

  const column = async (id: string) =>
    (await t.setup.execute(sql`select captions_enabled, captions_off_reason from videos where id = ${id}`)).rows[0] as {
      captions_enabled: boolean | null;
      captions_off_reason: string | null;
    };

  it('the check constraint rejects off without a reason', async () => {
    const video = await seedVideo(t.setup, { title: 'Constraint' });
    await expect(
      t.setup.update(videos).set({ captionsEnabled: false, captionsOffReason: null }).where(eq(videos.id, video.id)),
    ).rejects.toThrow();
    await expect(
      t.setup.update(videos).set({ captionsEnabled: false, captionsOffReason: 'abc' }).where(eq(videos.id, video.id)),
    ).rejects.toThrow();
  });

  it('new videos follow the site default', async () => {
    const video = await seedVideo(t.setup, { title: 'Default' });
    expect((await column(video.id)).captions_enabled).toBeNull();
  });

  it('switching off writes an audit row with the reason', async () => {
    const video = await seedVideo(t.setup, { title: 'Off with reason' });
    const done = await setCaptionsAvailability(ctx, admin, video.id, false, 'Sign language video');
    expect(done).toEqual({ ok: true });
    expect(await column(video.id)).toEqual({ captions_enabled: false, captions_off_reason: 'Sign language video' });
    const audit = await t.setup.execute(
      sql`select action, metadata from audit_log where target_id = ${video.id} and action = 'video.captions_availability'`,
    );
    expect(audit.rows).toHaveLength(1);
    expect(JSON.stringify(audit.rows[0])).toContain('Sign language video');
  });

  it('turning it back on clears the reason', async () => {
    const video = await seedVideo(t.setup, { title: 'Back on' });
    await setCaptionsAvailability(ctx, admin, video.id, false, 'Temporary reason');
    await setCaptionsAvailability(ctx, admin, video.id, null);
    expect(await column(video.id)).toEqual({ captions_enabled: null, captions_off_reason: null });
  });

  it('an editor cannot change availability', async () => {
    const video = await seedVideo(t.setup, { title: 'Editor denied' });
    await expect(setCaptionsAvailability(ctx, editor, video.id, true)).rejects.toThrow();
    expect((await column(video.id)).captions_enabled).toBeNull();
  });

  it('refuses off without a reason and an unknown video', async () => {
    const video = await seedVideo(t.setup, { title: 'No reason' });
    expect(await setCaptionsAvailability(ctx, admin, video.id, false, '')).toMatchObject({ ok: false });
    expect(await setCaptionsAvailability(ctx, admin, uuidv7(), true)).toMatchObject({ ok: false });
  });

  it('bulk switch reports failures per id, returns previous values and writes one row per video', async () => {
    const a = await seedVideo(t.setup, { title: 'Bulk a' });
    const b = await seedVideo(t.setup, { title: 'Bulk b' });
    await setCaptionsAvailability(ctx, admin, b.id, true);
    const ghost = uuidv7();
    const result = await setCaptionsAvailabilityMany(ctx, admin, [a.id, b.id, ghost], false, 'Audio only lessons', 'bulk-1');
    expect(result.succeeded).toEqual([a.id, b.id]);
    expect(result.failed.map((f) => f.id)).toEqual([ghost]);
    expect(result.previous).toEqual({ [a.id]: null, [b.id]: true });
    const audit = await t.setup.execute(
      sql`select metadata from audit_log where action = 'video.captions_availability' and metadata->>'bulkId' = 'bulk-1'`,
    );
    expect(audit.rows).toHaveLength(2);
  });
});
