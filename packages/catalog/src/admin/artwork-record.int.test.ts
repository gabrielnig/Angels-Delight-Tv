import { eq, sql } from 'drizzle-orm';
import { assets } from '@ad/db';
import { uuidv7, type Actor } from '@ad/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createViewerTestDb,
  integrationEnabled,
  seedAccount,
  seedAsset,
  type ViewerTestDb,
} from '../testing';
import { updateArtworkRecord } from './posters';
import type { AdminContext } from './types';

describe.skipIf(!integrationEnabled())('artwork record editing (M36)', () => {
  let t: ViewerTestDb;
  let ctx: AdminContext;
  let editor: Actor;
  let viewer: Actor;

  beforeAll(async () => {
    t = await createViewerTestDb();
    ctx = { db: t.app };
    editor = { accountId: (await seedAccount(t.setup, 'editor')).id, role: 'editor' };
    viewer = { accountId: (await seedAccount(t.setup, 'viewer')).id, role: 'viewer' };
  });
  afterAll(async () => {
    await t?.drop();
  });

  const row = async (id: string) =>
    (await t.setup.select().from(assets).where(eq(assets.id, id)))[0]!;

  it('changes the alt text and the placeholder colour and audits it', async () => {
    const id = await seedAsset(t.setup);
    const result = await updateArtworkRecord(ctx, editor, id, {
      alt: '  A girl counting naira notes ',
      placeholderColor: '#aabbcc',
    });
    expect(result).toEqual({ ok: true });
    expect(await row(id)).toMatchObject({
      altText: 'A girl counting naira notes',
      placeholderColor: '#AABBCC',
    });
    const log = await t.setup.execute(
      sql`SELECT action FROM audit_log WHERE target_id = ${id} AND action = 'asset.update'`,
    );
    expect(JSON.stringify(log)).toContain('asset.update');
  });

  it('leaves untouched fields alone and clears alt text with null', async () => {
    const id = await seedAsset(t.setup, { altText: 'Keep me', placeholderColor: '#112233' });
    await updateArtworkRecord(ctx, editor, id, { placeholderColor: '#445566' });
    expect(await row(id)).toMatchObject({ altText: 'Keep me', placeholderColor: '#445566' });
    await updateArtworkRecord(ctx, editor, id, { alt: null });
    expect((await row(id)).altText).toBeNull();
  });

  it('refuses alt text over 200 characters and colours that are not six digit hex', async () => {
    const id = await seedAsset(t.setup);
    expect(await updateArtworkRecord(ctx, editor, id, { alt: 'x'.repeat(201) })).toMatchObject({
      ok: false,
      error: expect.stringMatching(/200/),
    });
    expect(await updateArtworkRecord(ctx, editor, id, { placeholderColor: 'blue' })).toMatchObject({
      ok: false,
      error: expect.stringMatching(/colour/i),
    });
    expect((await row(id)).placeholderColor).toBe('#1F6FB5');
  });

  it('only edits pictures that are ready, refuses viewers, and says when it is missing', async () => {
    const pending = await seedAsset(t.setup, { status: 'processing' });
    expect(await updateArtworkRecord(ctx, editor, pending, { alt: 'x' })).toMatchObject({ ok: false });
    await expect(updateArtworkRecord(ctx, viewer, pending, { alt: 'x' })).rejects.toThrow();
    expect(await updateArtworkRecord(ctx, editor, uuidv7(), { alt: 'x' })).toMatchObject({
      ok: false,
      error: expect.stringMatching(/not found/i),
    });
  });
});
