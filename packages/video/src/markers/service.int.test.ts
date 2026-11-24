import { schema } from '@ad/db';
import {
  createTestDatabase,
  integrationEnabled,
  makeAccount,
  makeVideo,
  type TestDatabase,
} from '@ad/db/testing';
import { Forbidden, NotFound, ValidationFailed, type Actor } from '@ad/shared';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MarkerService } from './service';

describe.skipIf(!integrationEnabled())('MarkerService against Postgres', () => {
  let t: TestDatabase;
  let service: MarkerService;
  let editor: Actor;
  let viewer: Actor;
  let audit: { action: string; outcome: string; targetId?: string | null; metadata?: Record<string, unknown> }[];

  async function account(role: 'viewer' | 'editor'): Promise<Actor> {
    const row = makeAccount({ role });
    await t.db.insert(schema.accounts).values(row);
    return { accountId: row.id, role };
  }

  async function video(overrides: Parameters<typeof makeVideo>[0] = {}) {
    const row = makeVideo({
      status: 'ready',
      publishState: 'published',
      durationMs: 600_000,
      ...overrides,
    });
    await t.db.insert(schema.videos).values(row);
    return row.id;
  }

  beforeAll(async () => {
    t = await createTestDatabase();
    audit = [];
    service = new MarkerService({
      db: t.db,
      audit: {
        record: async (e) => {
          audit.push(e);
        },
      },
    });
    editor = await account('editor');
    viewer = await account('viewer');
  });
  afterAll(async () => {
    await t?.drop();
  });

  const intro = { kind: 'intro' as const, startMs: 12_000, endMs: 48_000 };
  const credits = { kind: 'credits' as const, startMs: 540_000, endMs: null };
  const chapters = [
    { startMs: 0, title: 'Welcome' },
    { startMs: 60_000, title: 'Mixing colours' },
  ];

  it('replaces markers and chapters in one transaction', async () => {
    const id = await video();
    await service.replace(editor, id, { markers: [intro, credits], chapters });
    await service.replace(editor, id, { markers: [credits], chapters: [chapters[0]!] });
    const got = await service.get(editor, id);
    expect(got.markers).toEqual([{ kind: 'credits', startMs: 540_000, endMs: null }]);
    expect(got.chapters).toEqual([{ startMs: 0, title: 'Welcome' }]);
    expect(got.durationMs).toBe(600_000);
  });

  it('rolls back everything when one chapter is invalid', async () => {
    const id = await video();
    await service.replace(editor, id, { markers: [intro], chapters });
    await expect(
      service.replace(editor, id, {
        markers: [credits],
        chapters: [{ startMs: 0, title: 'ok' }, { startMs: 2_000, title: 'too close' }],
      }),
    ).rejects.toBeInstanceOf(ValidationFailed);
    const got = await service.get(editor, id);
    expect(got.markers.map((m) => m.kind)).toEqual(['intro']);
    expect(got.chapters).toHaveLength(2);
  });

  it('rolls back when the database rejects a row after the markers were written', async () => {
    const id = await video({ durationMs: null, status: 'uploading', publishState: 'draft' });
    await service.replace(editor, id, { markers: [intro], chapters });
    await expect(
      service.replace(editor, id, {
        markers: [credits],
        chapters: [{ startMs: 0, title: 'ok' }, { startMs: 3_000_000_000, title: 'overflows' }],
      }),
    ).rejects.toThrow();
    const got = await service.get(editor, id);
    expect(got.markers.map((m) => m.kind)).toEqual(['intro']);
    expect(got.chapters).toHaveLength(2);
  });

  it('writes an audit row with counts', async () => {
    const id = await video();
    audit.length = 0;
    await service.replace(editor, id, { markers: [intro, credits], chapters });
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({
      action: 'video.markers.update',
      outcome: 'success',
      targetId: id,
      metadata: { markers: 2, chapters: 2 },
    });
  });

  it('refuses a viewer role', async () => {
    const id = await video();
    await expect(service.replace(viewer, id, { markers: [], chapters: [] })).rejects.toBeInstanceOf(
      Forbidden,
    );
    await expect(service.get(viewer, id)).rejects.toBeInstanceOf(Forbidden);
  });

  it('returns published markers without any viewer', async () => {
    const id = await video();
    await service.replace(editor, id, { markers: [intro, credits], chapters });
    const out = await service.getPublished(id);
    expect(out.markers.intro).toEqual({ startMs: 12_000, endMs: 48_000 });
    expect(out.markers.credits).toEqual({ startMs: 540_000, endMs: null });
    expect(out.markers.recap).toBeUndefined();
    expect(out.chapters).toEqual(chapters);
  });

  it('returns empty extras for a video with none or an unknown id', async () => {
    const id = await video();
    expect(await service.getPublished(id)).toEqual({ markers: {}, chapters: [] });
    expect(await service.getPublished('not-a-uuid')).toEqual({ markers: {}, chapters: [] });
  });

  it('does not return markers of an unpublished or deleted video through getPublished', async () => {
    const draft = await video({ publishState: 'draft' });
    await service.replace(editor, draft, { markers: [intro], chapters: [] });
    expect(await service.getPublished(draft)).toEqual({ markers: {}, chapters: [] });
    const gone = await video();
    await service.replace(editor, gone, { markers: [intro], chapters: [] });
    await t.db.update(schema.videos).set({ deletedAt: new Date() }).where(eq(schema.videos.id, gone));
    expect(await service.getPublished(gone)).toEqual({ markers: {}, chapters: [] });
  });

  it('deletes markers when the video is deleted', async () => {
    const id = await video();
    await service.replace(editor, id, { markers: [intro], chapters });
    await t.pool.query('DELETE FROM videos WHERE id = $1', [id]);
    const rows = await t.db.select().from(schema.videoMarkers).where(eq(schema.videoMarkers.videoId, id));
    expect(rows).toHaveLength(0);
  });

  it('is a not found for a video that does not exist', async () => {
    await expect(
      service.replace(editor, '0190aaaa-0000-7000-8000-000000000000', { markers: [], chapters: [] }),
    ).rejects.toBeInstanceOf(NotFound);
  });

  it('validates against the stored duration', async () => {
    const id = await video({ durationMs: 30_000 });
    await expect(
      service.replace(editor, id, { markers: [{ kind: 'intro', startMs: 20_000, endMs: 40_000 }], chapters: [] }),
    ).rejects.toBeInstanceOf(ValidationFailed);
  });
});
