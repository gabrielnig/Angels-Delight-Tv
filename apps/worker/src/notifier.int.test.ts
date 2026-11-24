import { schema } from '@ad/db';
import {
  createTestDatabase,
  integrationEnabled,
  makeAccount,
  makeVideo,
  type TestDatabase,
} from '@ad/db/testing';
import { createLogger } from '@ad/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { makeNotifier } from './notifier';

describe.skipIf(!integrationEnabled())('worker staff notifier', () => {
  let t: TestDatabase;
  let videoId: string;
  let staffId: string;

  beforeAll(async () => {
    t = await createTestDatabase();
    const staff = makeAccount({ role: 'admin' });
    staffId = staff.id;
    await t.db.insert(schema.accounts).values(staff);
    const video = makeVideo({
      title: 'Fractions',
      status: 'failed',
      failureMessage: 'The file could not be read.',
    });
    videoId = video.id;
    await t.db.insert(schema.videos).values(video);
  });
  afterAll(async () => {
    await t?.drop();
  });

  it('writes plain, linked notices for the staff bell', async () => {
    const notifier = makeNotifier(t.db, createLogger({ write: () => undefined }));
    await notifier.encodeFailed(videoId, 'fallback');
    await notifier.captionsReady(videoId);
    const rows = await t.db.select().from(schema.adminNotices);
    const failed = rows.find((r) => r.kind === 'encode_failed')!;
    expect(failed).toMatchObject({
      recipientId: staffId,
      title: 'Encoding failed',
      body: 'Fractions: The file could not be read.',
      href: `/admin/videos/${videoId}`,
      videoId,
    });
    expect(rows.find((r) => r.kind === 'captions_ready')).toMatchObject({
      title: 'Captions ready to review',
      href: `/admin/captions/${videoId}`,
    });
  });

  it('tells staff a poster crop could not be applied and that the old poster stays', async () => {
    const notifier = makeNotifier(t.db, createLogger({ write: () => undefined }));
    await notifier.posterRecutFailed(videoId);
    const rows = await t.db.select().from(schema.adminNotices);
    expect(rows.find((r) => r.title === 'Poster crop could not be applied')).toMatchObject({
      kind: 'encode_failed',
      body: 'Fractions: the old poster is still showing. Open the poster page and save again.',
      href: `/admin/videos/${videoId}/poster`,
      videoId,
    });
  });

  it('names the language in translation notices and links to that track', async () => {
    const notifier = makeNotifier(t.db, createLogger({ write: () => undefined }));
    await notifier.translationReady(videoId, 'yo');
    await notifier.translationFailed(videoId, 'ha');
    const rows = await t.db.select().from(schema.adminNotices);
    expect(rows.find((r) => r.title === 'Yoruba captions ready to review')).toMatchObject({
      kind: 'captions_ready',
      href: `/admin/captions/${videoId}?lang=yo`,
    });
    expect(rows.find((r) => r.title === 'Hausa captions could not be made')).toMatchObject({
      kind: 'captions_failed',
      href: `/admin/captions/${videoId}?lang=ha`,
    });
  });

  it('copes with a video that is gone', async () => {
    const notifier = makeNotifier(t.db, createLogger({ write: () => undefined }));
    await expect(
      notifier.encodeDone('0192f0a0-0000-7000-8000-00000000dead'),
    ).resolves.toBeUndefined();
  });
});
