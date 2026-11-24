import { uuidv7 } from '@ad/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { videos } from './schema';
import { createTestDatabase, integrationEnabled, makeVideo, type TestDatabase } from './testing';

describe.skipIf(!integrationEnabled())('row links (migrations row_kinds and row_links)', () => {
  let t: TestDatabase;
  let position = 100;
  beforeAll(async () => {
    t = await createTestDatabase();
  });
  afterAll(async () => {
    await t?.drop();
  });

  const insert = (fields: Record<string, unknown> = {}) => {
    const values = { id: uuidv7(), title: 'Row', kind: 'curated', position: position++, ...fields };
    const keys = Object.keys(values);
    return t.pool.query(
      `INSERT INTO rows (${keys.map((k) => `"${k}"`).join(',')}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(',')})`,
      Object.values(values),
    );
  };

  it('knows the two new automatic row kinds', async () => {
    await expect(insert({ kind: 'each_category' })).resolves.toBeDefined();
    await expect(insert({ kind: 'all_series' })).resolves.toBeDefined();
  });

  it('defaults to an automatic View all with a minimum of one title', async () => {
    const id = uuidv7();
    await insert({ id });
    const { rows } = await t.pool.query('SELECT view_all_mode, view_all_url, min_items, slug FROM rows WHERE id = $1', [id]);
    expect(rows[0]).toMatchObject({ view_all_mode: 'auto', view_all_url: null, min_items: 1, slug: null });
  });

  it('accepts a site path and an https link in custom mode', async () => {
    await expect(insert({ view_all_mode: 'custom', view_all_url: '/browse/new' })).resolves.toBeDefined();
    await expect(
      insert({ view_all_mode: 'custom', view_all_url: 'https://example.org/x' }),
    ).resolves.toBeDefined();
  });

  it.each([
    ['no url', null],
    ['a protocol relative url', '//evil.com'],
    ['http', 'http://example.org'],
    ['javascript', 'javascript:alert(1)'],
    ['a url with a space', '/browse/a b'],
    ['an over long url', `/${'a'.repeat(300)}`],
  ])('refuses custom mode with %s', async (_name, url) => {
    await expect(insert({ view_all_mode: 'custom', view_all_url: url })).rejects.toThrow(
      /rows_view_all_custom_has_url/,
    );
  });

  it('refuses an unknown mode and a minimum outside 1 to 20', async () => {
    await expect(insert({ view_all_mode: 'sometimes' })).rejects.toThrow(/rows_view_all_mode/);
    await expect(insert({ min_items: 0 })).rejects.toThrow(/rows_min_items_range/);
    await expect(insert({ min_items: 21 })).rejects.toThrow(/rows_min_items_range/);
  });

  it('keeps row slugs unique when set', async () => {
    await insert({ slug: 'farming-basics' });
    await expect(insert({ slug: 'farming-basics' })).rejects.toThrow(/rows_slug/);
    await expect(insert({ slug: null })).resolves.toBeDefined();
    await expect(insert({ slug: null })).resolves.toBeDefined();
  });

  it('refuses a category slug that a list page owns', async () => {
    for (const slug of ['new', 'trending', 'series', 'row']) {
      await expect(
        t.pool.query(`INSERT INTO categories (id, slug, name) VALUES ($1, $2, $3)`, [uuidv7(), slug, `Cat ${slug}`]),
      ).rejects.toThrow(/categories_slug_not_reserved/);
    }
    await expect(
      t.pool.query(`INSERT INTO categories (id, slug, name) VALUES ($1, 'new-farming', 'New farming')`, [uuidv7()]),
    ).resolves.toBeDefined();
  });

  it('stores hero slide text up to 80 characters on row items', async () => {
    const rowId = uuidv7();
    await insert({ id: rowId, kind: 'hero' });
    const video = makeVideo();
    await t.db.insert(videos).values(video);
    const videoId = video.id;
    await expect(
      t.pool.query(
        `INSERT INTO row_items (id, row_id, position, video_id, hero_headline, hero_blurb, hero_button_label) VALUES ($1, $2, 0, $3, 'Head', 'Blurb', 'Watch now')`,
        [uuidv7(), rowId, videoId],
      ),
    ).resolves.toBeDefined();
    await expect(
      t.pool.query(
        `INSERT INTO row_items (id, row_id, position, video_id, hero_headline) VALUES ($1, $2, 1, $3, $4)`,
        [uuidv7(), rowId, videoId, 'x'.repeat(81)],
      ),
    ).rejects.toThrow(/row_items_hero_text_length/);
  });
});
