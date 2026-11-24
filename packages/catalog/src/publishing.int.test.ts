import { eq } from 'drizzle-orm';
import { captions, captionTracks, videoKeys, videos } from '@ad/db';
import { uuidv7 } from '@ad/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { cancelSchedule, promoteDueScheduled, publish, unpublish } from './publishing';
import {
  categorize,
  createViewerTestDb,
  FUTURE,
  integrationEnabled,
  NOW,
  seedAccount,
  seedAsset,
  seedCategory,
  seedVideo,
  type ViewerTestDb,
} from './testing';

describe.skipIf(!integrationEnabled())('publishing', () => {
  let t: ViewerTestDb;
  let editor: { accountId: string; role: 'editor' };
  let viewer: { accountId: string; role: 'viewer' };
  let admin: { accountId: string; role: 'admin' };
  let cat: { id: string };
  const ctxFor = (requireApprovedCaptions = false) => ({
    db: t.app,
    now: () => NOW,
    requireApprovedCaptions,
  });

  async function draft(over: Record<string, unknown> = {}) {
    const poster = await seedAsset(t.setup);
    const v = await seedVideo(t.setup, {
      publishState: 'draft',
      publishedAt: null,
      posterAssetId: poster,
      description: 'About it',
      maturityRank: 0,
      ...over,
    });
    await categorize(t.setup, { videoId: v.id }, cat.id);
    return v;
  }
  const state = async (id: string) =>
    (await t.setup.select().from(videos).where(eq(videos.id, id)))[0]!;

  beforeAll(async () => {
    t = await createViewerTestDb();
    editor = { accountId: (await seedAccount(t.setup, 'editor')).id, role: 'editor' };
    viewer = { accountId: (await seedAccount(t.setup)).id, role: 'viewer' };
    admin = { accountId: (await seedAccount(t.setup, 'admin')).id, role: 'admin' };
    cat = await seedCategory(t.setup, 'Science');
  });
  afterAll(async () => {
    await t?.drop();
  });

  it('publishes a complete video and stamps the date', async () => {
    const v = await draft();
    const r = await publish(ctxFor(), editor, 'video', v.id);
    expect(r.publishState).toBe('published');
    expect(r.publishedAt).toBe(NOW.toISOString());
  });

  it('blocks publishing when the encrypted video has no HLS key (M31-S02)', async () => {
    const v = await draft();
    await t.setup.delete(videoKeys).where(eq(videoKeys.videoId, v.id));
    await expect(publish(ctxFor(), editor, 'video', v.id)).rejects.toMatchObject({
      fields: { checklist: ['Encoding is finished'] },
    });
    expect((await state(v.id)).publishState).toBe('draft');
  });

  it('lists every missing item when the checklist fails', async () => {
    const v = await draft({ posterAssetId: null, description: '' });
    await expect(publish(ctxFor(), editor, 'video', v.id)).rejects.toMatchObject({
      fields: { checklist: ['Add a description', 'Choose a poster'] },
    });
    expect((await state(v.id)).publishState).toBe('draft');
  });

  it('publish is blocked until a maturity rating is chosen', async () => {
    const v = await draft({ maturityRank: null });
    await expect(publish(ctxFor(), editor, 'video', v.id)).rejects.toMatchObject({
      fields: { checklist: ['Choose a maturity rating'] },
    });
    expect((await state(v.id)).publishState).toBe('draft');
    await t.setup.update(videos).set({ maturityRank: 3 }).where(eq(videos.id, v.id));
    const r = await publish(ctxFor(), editor, 'video', v.id);
    expect(r.publishState).toBe('published');
  });

  it('refuses viewers and unknown ids', async () => {
    const v = await draft();
    await expect(publish(ctxFor(), viewer, 'video', v.id)).rejects.toMatchObject({ status: 403 });
    await expect(publish(ctxFor(), editor, 'video', uuidv7())).rejects.toMatchObject({
      status: 404,
    });
    await expect(publish(ctxFor(), editor, 'video', 'nope')).rejects.toMatchObject({ status: 404 });
  });

  it('schedules in the future only, and cancel returns to draft', async () => {
    const v = await draft();
    await expect(
      publish(ctxFor(), editor, 'video', v.id, { publishAt: new Date(NOW.getTime() - 1000) }),
    ).rejects.toMatchObject({ status: 422 });
    const r = await publish(ctxFor(), editor, 'video', v.id, { publishAt: FUTURE });
    expect(r.publishState).toBe('scheduled');
    expect((await cancelSchedule(ctxFor(), editor, 'video', v.id)).publishState).toBe('draft');
    await expect(cancelSchedule(ctxFor(), editor, 'video', v.id)).rejects.toMatchObject({
      status: 409,
    });
  });

  it('unpublish then republish keeps the original publish date', async () => {
    const v = await draft();
    const first = await publish(ctxFor(), editor, 'video', v.id);
    const later = { ...ctxFor(), now: () => new Date(NOW.getTime() + 86_400_000) };
    await unpublish(later, editor, 'video', v.id);
    const again = await publish(later, editor, 'video', v.id);
    expect(again.publishedAt).toBe(first.publishedAt);
    await expect(unpublish(later, editor, 'video', uuidv7())).rejects.toMatchObject({
      status: 404,
    });
  });

  it('requires approved captions unless an admin overrides with a reason', async () => {
    const v = await draft();
    await expect(publish(ctxFor(true), editor, 'video', v.id)).rejects.toMatchObject({
      fields: { checklist: ['Approve captions'] },
    });
    await expect(
      publish(ctxFor(true), editor, 'video', v.id, { captionOverride: { reason: 'urgent news' } }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      publish(ctxFor(true), admin, 'video', v.id, { captionOverride: { reason: 'x' } }),
    ).rejects.toMatchObject({ status: 422 });
    const r = await publish(ctxFor(true), admin, 'video', v.id, {
      captionOverride: { reason: 'urgent news' },
    });
    expect(r.publishState).toBe('published');
  });

  it('a video with captions switched off publishes without approved captions', async () => {
    const v = await draft({ captionsEnabled: false, captionsOffReason: 'Sign language video' });
    expect((await publish(ctxFor(true), editor, 'video', v.id)).publishState).toBe('published');
  });

  it('a video following a site default of off publishes without approved captions', async () => {
    const v = await draft();
    const ctx = { ...ctxFor(true), captionsDefaultAvailable: false };
    expect((await publish(ctx, editor, 'video', v.id)).publishState).toBe('published');
  });

  it('the gate still blocks when captions are on and unapproved', async () => {
    const own = await draft({ captionsEnabled: true });
    await expect(publish({ ...ctxFor(true), captionsDefaultAvailable: false }, editor, 'video', own.id)).rejects.toMatchObject({
      fields: { checklist: ['Approve captions'] },
    });
    const followed = await draft();
    await expect(publish({ ...ctxFor(true), captionsDefaultAvailable: true }, editor, 'video', followed.id)).rejects.toMatchObject({
      fields: { checklist: ['Approve captions'] },
    });
  });

  it('accepts approved captions', async () => {
    const v = await draft();
    const trackId = uuidv7();
    const capId = uuidv7();
    await t.setup
      .insert(captionTracks)
      .values({ id: trackId, videoId: v.id, language: 'en', label: 'English', kind: 'captions' });
    await t.setup.insert(captions).values({
      id: capId,
      trackId,
      revision: 1,
      source: 'manual',
      status: 'approved',
      storageKey: `c/${capId}.vtt`,
      sha256: Buffer.alloc(32),
      bytes: 10,
      cueCount: 1,
      publicKey: `c/${capId}.public.vtt`,
      reviewedBy: editor.accountId,
      reviewedAt: NOW,
    });
    await t.setup
      .update(captionTracks)
      .set({ approvedCaptionId: capId })
      .where(eq(captionTracks.id, trackId));
    expect((await publish(ctxFor(true), editor, 'video', v.id)).publishState).toBe('published');
  });

  it('promoter publishes due items and demotes ones that no longer pass', async () => {
    const ok = await draft();
    const bad = await draft();
    const future = { ...ctxFor(), now: () => new Date(FUTURE.getTime() - 60_000) };
    await publish(future, editor, 'video', ok.id, { publishAt: FUTURE });
    await publish(future, editor, 'video', bad.id, { publishAt: FUTURE });
    await t.setup.update(videos).set({ description: '' }).where(eq(videos.id, bad.id));
    const report = await promoteDueScheduled({
      ...ctxFor(),
      now: () => new Date(FUTURE.getTime() + 1000),
    });
    expect(report.published.map((p) => p.id)).toContain(ok.id);
    expect(report.blocked.find((b) => b.id === bad.id)?.reasons).toEqual(['Add a description']);
    expect((await state(ok.id)).publishState).toBe('published');
    expect((await state(bad.id)).publishState).toBe('draft');
  });
});
