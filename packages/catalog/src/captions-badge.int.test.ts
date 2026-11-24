import { eq } from 'drizzle-orm';
import { captions, captionTracks, settings, videos } from '@ad/db';
import { uuidv7 } from '@ad/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createViewerTestDb,
  integrationEnabled,
  NOW,
  runAs,
  seedAccount,
  seedVideo,
  type ViewerTestDb,
} from './testing';
import { findTitle } from './detail';
import { fetchCards } from './titles';
import type { CatalogContext } from './types';
import { fetchVideoCards } from './videos';

const ctx: CatalogContext = { mediaOrigin: 'https://media.test', now: () => NOW };

describe.skipIf(!integrationEnabled())('the CC badge follows the captions switch', () => {
  let t: ViewerTestDb;
  let run: ReturnType<typeof runAs>;
  let reviewer: string;

  beforeAll(async () => {
    t = await createViewerTestDb();
    run = runAs(t.app, { accountId: (await seedAccount(t.setup)).id, role: 'viewer' });
    reviewer = (await seedAccount(t.setup, 'editor')).id;
  });
  afterAll(async () => {
    await t?.drop();
  });

  async function captioned(over: Partial<typeof videos.$inferInsert> = {}) {
    const video = await seedVideo(t.setup, over);
    const trackId = uuidv7();
    const capId = uuidv7();
    await t.setup.insert(captionTracks).values({ id: trackId, videoId: video.id, language: 'en', label: 'English', kind: 'captions' });
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
      publicKey: `cap/${capId}.vtt`,
      reviewedBy: reviewer,
      reviewedAt: NOW,
    });
    await t.setup.update(captionTracks).set({ approvedCaptionId: capId }).where(eq(captionTracks.id, trackId));
    return video;
  }

  const badge = async (id: string) => {
    const [card] = await run((tx) => fetchCards(tx, ctx, { kids: false }, [{ kind: 'video', id }]));
    const map = await run((tx) => fetchVideoCards(tx, ctx, { kids: false }, [id]));
    expect(map.get(id)?.hasCaptions).toBe(card?.hasCaptions);
    return card?.hasCaptions;
  };

  it('is shown for a captioned video that follows the default of on', async () => {
    const video = await captioned();
    expect(await badge(video.id)).toBe(true);
  });

  it('the badge is hidden when captions are switched off', async () => {
    const video = await captioned({ captionsEnabled: false, captionsOffReason: 'Sign language video' });
    expect(await badge(video.id)).toBe(false);
  });

  it('the title detail lists no caption tracks when captions are off, and lists them when on', async () => {
    const off = await captioned({ captionsEnabled: false, captionsOffReason: 'Sign language video' });
    const on = await captioned({ captionsEnabled: true });
    const detail = async (id: string) => {
      const found = await run((tx) => findTitle(tx, ctx, { kids: false }, { id, kind: 'video' }));
      return found?.type === 'title' ? found.title.captionTracks : null;
    };
    expect(await detail(off.id)).toEqual([]);
    expect(await detail(on.id)).toHaveLength(1);
  });

  it('follows a site default of off, unless the video says on', async () => {
    const following = await captioned();
    const explicit = await captioned({ captionsEnabled: true });
    await t.setup.insert(settings).values({ key: 'features.captions_default_available', value: false });
    expect(await badge(following.id)).toBe(false);
    expect(await badge(explicit.id)).toBe(true);
  });
});
