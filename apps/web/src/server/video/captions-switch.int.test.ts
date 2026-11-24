import { schema } from '@ad/db';
import { uuidv7 } from '@ad/shared';
import { DrizzlePlaybackStore } from '@ad/video';
import { NOW, createViewerTestDb, integrationEnabled, seedAccount, seedVideo, type ViewerTestDb } from '@ad/viewer/testing';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

describe.skipIf(!integrationEnabled())('playback captions follow the captions switch', () => {
  let t: ViewerTestDb;
  let store: DrizzlePlaybackStore;

  beforeAll(async () => {
    t = await createViewerTestDb();
    store = new DrizzlePlaybackStore(t.app);
  });
  afterAll(async () => {
    await t?.drop();
  });

  async function withApprovedTrack(over: Partial<typeof schema.videos.$inferInsert> = {}) {
    const video = await seedVideo(t.setup, over);
    const trackId = uuidv7();
    const capId = uuidv7();
    await t.setup
      .insert(schema.captionTracks)
      .values({ id: trackId, videoId: video.id, language: 'en', label: 'English', kind: 'captions' });
    await t.setup.insert(schema.captions).values({
      id: capId,
      trackId,
      revision: 1,
      source: 'manual',
      status: 'approved',
      storageKey: `c/${capId}.vtt`,
      sha256: Buffer.alloc(32),
      bytes: 10,
      cueCount: 1,
      publicKey: `cap/${capId}.vtt`,
      reviewedBy: (await seedAccount(t.setup, 'editor')).id,
      reviewedAt: NOW,
    });
    await t.setup
      .update(schema.captionTracks)
      .set({ approvedCaptionId: capId })
      .where(eq(schema.captionTracks.id, trackId));
    return video;
  }

  const setSiteDefault = async (value: boolean) => {
    await t.setup
      .insert(schema.settings)
      .values({ key: 'features.captions_default_available', value })
      .onConflictDoUpdate({ target: schema.settings.key, set: { value } });
  };

  it('lists approved tracks while captions follow a default of on', async () => {
    await setSiteDefault(true);
    const video = await withApprovedTrack();
    expect(await store.captions(video.id)).toHaveLength(1);
  });

  it('the session lists no caption tracks when effective captions are off', async () => {
    await setSiteDefault(true);
    const video = await withApprovedTrack({ captionsEnabled: false, captionsOffReason: 'Sign language video' });
    expect(await store.captions(video.id)).toEqual([]);
  });

  it('a site default of off hides tracks for videos that follow it, but not for explicit on', async () => {
    const following = await withApprovedTrack();
    const explicit = await withApprovedTrack({ captionsEnabled: true });
    await setSiteDefault(false);
    expect(await store.captions(following.id)).toEqual([]);
    expect(await store.captions(explicit.id)).toHaveLength(1);
  });

  it('approved tracks are listed again after switching back on', async () => {
    await setSiteDefault(true);
    const video = await withApprovedTrack({ captionsEnabled: false, captionsOffReason: 'Temporary reason' });
    expect(await store.captions(video.id)).toEqual([]);
    await t.setup
      .update(schema.videos)
      .set({ captionsEnabled: null, captionsOffReason: null })
      .where(eq(schema.videos.id, video.id));
    expect(await store.captions(video.id)).toHaveLength(1);
  });
});
