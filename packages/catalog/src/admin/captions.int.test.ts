import { eq } from 'drizzle-orm';
import { captionTracks, captions, jobs, videos } from '@ad/db';
import type { Actor } from '@ad/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createViewerTestDb,
  integrationEnabled,
  seedAccount,
  seedVideo,
  type ViewerTestDb,
} from '../testing';
import { clearCaptionOverride, listAdminCaptionRows } from './captions';
import type { AdminContext } from './types';

describe.skipIf(!integrationEnabled())('admin caption rows', () => {
  let t: ViewerTestDb;
  let ctx: AdminContext;
  let editor: Actor;
  let viewer: Actor;

  async function track(videoId: string) {
    const [row] = await t.setup
      .insert(captionTracks)
      .values({ videoId, language: 'en', label: 'English', kind: 'captions', isDefault: true })
      .returning();
    return row!;
  }
  async function revision(
    trackId: string,
    n: number,
    status: 'draft' | 'in_review' | 'approved' | 'rejected' | 'superseded',
    extra: Partial<typeof captions.$inferInsert> = {},
  ) {
    const [row] = await t.setup
      .insert(captions)
      .values({
        trackId,
        revision: n,
        source: 'whisper',
        status,
        storageKey: `k/${trackId}/${n}`,
        sha256: Buffer.alloc(32),
        bytes: 10,
        cueCount: 12 + n,
        ...(status === 'approved'
          ? {
              reviewedBy: editor.accountId,
              reviewedAt: new Date('2026-06-01T10:00:00Z'),
              publicKey: `pub/${trackId}`,
            }
          : {}),
        ...extra,
      })
      .returning();
    return row!;
  }

  beforeAll(async () => {
    t = await createViewerTestDb();
    ctx = { db: t.app };
    editor = { accountId: (await seedAccount(t.setup, 'editor')).id, role: 'editor' };
    viewer = { accountId: (await seedAccount(t.setup)).id, role: 'viewer' };
  });
  afterAll(async () => {
    await t?.drop();
  });

  it('refuses a viewer', async () => {
    await expect(listAdminCaptionRows(ctx, viewer)).rejects.toThrow();
    await expect(
      clearCaptionOverride(ctx, viewer, '00000000-0000-7000-8000-000000000000'),
    ).rejects.toThrow();
  });

  it('lists ready videos with their caption state, count and who touched them last', async () => {
    const none = await seedVideo(t.setup, { title: 'No captions yet' });
    const review = await seedVideo(t.setup, { title: 'Waiting for review' });
    const approved = await seedVideo(t.setup, { title: 'Approved' });
    const generating = await seedVideo(t.setup, { title: 'Generating' });
    const processing = await seedVideo(t.setup, {
      title: 'Still encoding',
      status: 'encoding',
      publishState: 'draft',
    });
    const trashed = await seedVideo(t.setup, { title: 'In trash', deletedAt: new Date() });

    const reviewTrack = await track(review.id);
    await revision(reviewTrack.id, 1, 'in_review', { createdAt: new Date('2026-06-02T08:00:00Z') });
    const approvedTrack = await track(approved.id);
    await revision(approvedTrack.id, 1, 'approved', { createdBy: editor.accountId });
    await track(generating.id);
    await t.setup
      .insert(jobs)
      .values({ queue: 'caption.generate', videoId: generating.id, status: 'running' });

    const rows = await listAdminCaptionRows(ctx, editor);
    const byTitle = Object.fromEntries(rows.map((r) => [r.title, r]));
    expect(byTitle['No captions yet']).toMatchObject({
      videoId: none.id,
      state: 'none',
      cueCount: null,
      updatedAt: null,
      updatedBy: null,
    });
    expect(byTitle['Waiting for review']).toMatchObject({
      state: 'needs_review',
      cueCount: 13,
      updatedAt: '2026-06-02T08:00:00.000Z',
      updatedBy: null,
      untouchedAuto: true,
    });
    expect(byTitle.Approved).toMatchObject({
      state: 'approved',
      cueCount: 13,
      updatedBy: editor.accountId,
      untouchedAuto: false,
    });
    expect(byTitle.Generating?.state).toBe('generating');
    expect(byTitle['No captions yet']?.untouchedAuto).toBe(false);
    expect(byTitle['Still encoding']).toBeUndefined();
    expect(byTitle['In trash']).toBeUndefined();
    void processing;
    void trashed;
  });

  it('is not untouched once a person made the newest revision', async () => {
    const edited = await seedVideo(t.setup, { title: 'Edited by hand' });
    const editedTrack = await track(edited.id);
    await revision(editedTrack.id, 1, 'in_review', { createdBy: editor.accountId });
    const rows = await listAdminCaptionRows(ctx, editor);
    expect(rows.find((r) => r.title === 'Edited by hand')?.untouchedAuto).toBe(false);
  });

  it('reports a failed generation when no captions exist yet', async () => {
    const video = await seedVideo(t.setup, { title: 'Failed generation' });
    await t.setup.insert(jobs).values({
      queue: 'caption.generate',
      videoId: video.id,
      status: 'failed_permanent',
      errorMessage: 'The audio was too quiet.',
    });
    const row = (await listAdminCaptionRows(ctx, editor)).find((r) => r.videoId === video.id)!;
    expect(row.state).toBe('failed');
  });

  it('clears the caption override once captions are approved', async () => {
    const video = await seedVideo(t.setup);
    await t.setup
      .update(videos)
      .set({ captionOverrideReason: 'Music only' })
      .where(eq(videos.id, video.id));
    await clearCaptionOverride(ctx, editor, video.id);
    const [row] = await t.setup.select().from(videos).where(eq(videos.id, video.id));
    expect(row?.captionOverrideReason).toBeNull();
  });
});
