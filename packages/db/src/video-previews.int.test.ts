import { uuidv7 } from '@ad/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { videos } from './schema';
import { createTestDatabase, integrationEnabled, makeAccount, makeVideo, type TestDatabase } from './testing';
import { accounts } from './schema';
import { eq } from 'drizzle-orm';

describe.skipIf(!integrationEnabled())('video preview columns (migration video_previews)', () => {
  let t: TestDatabase;
  let owner: string;
  beforeAll(async () => {
    t = await createTestDatabase();
    const account = makeAccount({ role: 'editor' });
    await t.db.insert(accounts).values(account);
    owner = account.id;
  });
  afterAll(async () => {
    await t?.drop();
  });

  const add = async () => {
    const video = makeVideo({ createdBy: owner, id: uuidv7() });
    await t.db.insert(videos).values(video);
    return video.id;
  };
  const set = (id: string, fields: Record<string, unknown>) => {
    const keys = Object.keys(fields);
    return t.pool.query(
      `UPDATE videos SET ${keys.map((k, i) => `"${k}" = $${i + 2}`).join(', ')} WHERE id = $1`,
      [id, ...Object.values(fields)],
    );
  };

  it('starts every video with no clip, automatic mode and nothing recorded', async () => {
    const id = await add();
    const [row] = await t.db.select().from(videos).where(eq(videos.id, id));
    expect(row).toMatchObject({
      previewKey: null,
      previewState: 'none',
      previewMode: 'auto',
      previewStartMs: null,
      previewBytes: null,
      previewNote: null,
      previewUpdatedAt: null,
      previewHasAudio: false,
      previewLengthMs: null,
    });
  });

  it('records the clip length and whether it carries sound, and allows both to stay unset', async () => {
    const id = await add();
    await expect(set(id, { preview_length_ms: 20000, preview_has_audio: true })).resolves.toBeDefined();
    await expect(set(id, { preview_length_ms: null })).resolves.toBeDefined();
    await expect(set(id, { preview_length_ms: 0 })).rejects.toThrow(/videos_preview_length/);
    await expect(set(id, { preview_length_ms: -5 })).rejects.toThrow(/videos_preview_length/);
  });

  it('marks clips made before sound existed as silent, so the sound button stays hidden for them', async () => {
    const id = await add();
    await set(id, { preview_state: 'ready', preview_key: 'cap/x/preview/0-abcd1234.mp4', preview_bytes: 500000 });
    const [row] = await t.db.select().from(videos).where(eq(videos.id, id));
    expect(row?.previewHasAudio).toBe(false);
    expect(row?.previewLengthMs).toBeNull();
  });

  it('accepts each known state and mode', async () => {
    const id = await add();
    for (const state of ['none', 'queued', 'ready', 'failed', 'skipped'])
      await expect(set(id, { preview_state: state })).resolves.toBeDefined();
    for (const mode of ['auto', 'picked', 'off'])
      await expect(set(id, { preview_mode: mode })).resolves.toBeDefined();
  });

  it('refuses an unknown state or mode', async () => {
    const id = await add();
    await expect(set(id, { preview_state: 'done' })).rejects.toThrow(/videos_preview_state_known/);
    await expect(set(id, { preview_mode: 'always' })).rejects.toThrow(/videos_preview_mode_known/);
  });

  it('refuses a negative start or size', async () => {
    const id = await add();
    await expect(set(id, { preview_start_ms: -1 })).rejects.toThrow(/videos_preview_numbers/);
    await expect(set(id, { preview_bytes: -1 })).rejects.toThrow(/videos_preview_numbers/);
    await expect(set(id, { preview_start_ms: 12300, preview_bytes: 600000 })).resolves.toBeDefined();
  });

  it('indexes published videos that still need a clip, for the hourly sweep', async () => {
    const { rows } = await t.pool.query(
      `SELECT indexname FROM pg_indexes WHERE tablename = 'videos' AND indexname = 'videos_preview_sweep'`,
    );
    expect(rows).toHaveLength(1);
  });
});
