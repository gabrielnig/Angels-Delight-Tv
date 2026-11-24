import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { videoChapters, videoMarkers, videos } from './schema';
import { createTestDatabase, integrationEnabled, makeVideo, type TestDatabase } from './testing';

describe.skipIf(!integrationEnabled())('video markers and chapters tables', () => {
  let t: TestDatabase;
  let videoId: string;
  beforeAll(async () => {
    t = await createTestDatabase();
    const video = makeVideo({ durationMs: 600_000 });
    await t.db.insert(videos).values(video);
    videoId = video.id;
  });
  afterAll(async () => {
    await t?.drop();
  });

  it('rejects an unknown marker kind', async () => {
    await expect(
      t.db.insert(videoMarkers).values({ videoId, kind: 'outro', startMs: 0, endMs: 5000 }),
    ).rejects.toThrow();
  });

  it('rejects an end before the start', async () => {
    await expect(
      t.db.insert(videoMarkers).values({ videoId, kind: 'intro', startMs: 5000, endMs: 1000 }),
    ).rejects.toThrow();
  });

  it('requires an end for intro and recap', async () => {
    await expect(
      t.db.insert(videoMarkers).values({ videoId, kind: 'recap', startMs: 0, endMs: null }),
    ).rejects.toThrow();
  });

  it('allows credits without an end', async () => {
    await t.db.insert(videoMarkers).values({ videoId, kind: 'credits', startMs: 540_000 });
    const rows = await t.db.select().from(videoMarkers);
    expect(rows.find((r) => r.kind === 'credits')?.endMs).toBeNull();
  });

  it('allows one marker per kind per video', async () => {
    await t.db.insert(videoMarkers).values({ videoId, kind: 'intro', startMs: 0, endMs: 10_000 });
    await expect(
      t.db.insert(videoMarkers).values({ videoId, kind: 'intro', startMs: 20_000, endMs: 30_000 }),
    ).rejects.toThrow();
  });

  it('rejects two chapters at the same time', async () => {
    await t.db.insert(videoChapters).values({ videoId, startMs: 0, title: 'One' });
    await expect(
      t.db.insert(videoChapters).values({ videoId, startMs: 0, title: 'Two' }),
    ).rejects.toThrow();
  });

  it('rejects a chapter title over 60 characters and an empty title', async () => {
    await expect(
      t.db.insert(videoChapters).values({ videoId, startMs: 10_000, title: 'x'.repeat(61) }),
    ).rejects.toThrow();
    await expect(
      t.db.insert(videoChapters).values({ videoId, startMs: 10_000, title: '' }),
    ).rejects.toThrow();
  });

  it('deletes markers and chapters with the video', async () => {
    const other = makeVideo({ durationMs: 100_000 });
    await t.db.insert(videos).values(other);
    await t.db.insert(videoMarkers).values({ videoId: other.id, kind: 'intro', startMs: 0, endMs: 5000 });
    await t.db.insert(videoChapters).values({ videoId: other.id, startMs: 0, title: 'Only' });
    await t.pool.query('DELETE FROM videos WHERE id = $1', [other.id]);
    const left = await t.pool.query('SELECT 1 FROM video_markers WHERE video_id = $1', [other.id]);
    const chapters = await t.pool.query('SELECT 1 FROM video_chapters WHERE video_id = $1', [other.id]);
    expect(left.rowCount).toBe(0);
    expect(chapters.rowCount).toBe(0);
  });
});
