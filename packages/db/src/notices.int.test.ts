import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { accounts, profiles, series, videos } from './schema';
import {
  asRole,
  createTestDatabase,
  integrationEnabled,
  makeAccount,
  makeProfile,
  makeVideo,
  type TestDatabase,
} from './testing';

describe.skipIf(!integrationEnabled())('viewer notices (migration viewer_notices)', () => {
  let t: TestDatabase;
  let accountA: ReturnType<typeof makeAccount>;
  let accountB: ReturnType<typeof makeAccount>;
  let adultA: ReturnType<typeof makeProfile>;
  let kidsA: ReturnType<typeof makeProfile>;
  let adultB: ReturnType<typeof makeProfile>;

  beforeAll(async () => {
    t = await createTestDatabase();
    accountA = makeAccount();
    accountB = makeAccount();
    await t.db.insert(accounts).values([accountA, accountB]);
    adultA = makeProfile(accountA.id, { isPrimary: true });
    kidsA = makeProfile(accountA.id, { isKids: true, position: 1 });
    adultB = makeProfile(accountB.id, { isPrimary: true });
    await t.db.insert(profiles).values([adultA, kidsA, adultB]);
  });
  afterAll(async () => {
    await t?.drop();
  });

  const insertNotice = (profileId: string, key: string, kind = 'new_video') =>
    asRole(t.pool, 'ad_worker', {}, (c) =>
      c.query(
        `INSERT INTO viewer_notices (profile_id, kind, title, href, dedupe_key) VALUES ($1, $2, 'T', '/x', $3)`,
        [profileId, kind, key],
      ),
    );

  it('the worker inserts notices, the dedupe key is unique per profile and the kind is checked', async () => {
    await insertNotice(adultA.id, 'video:1');
    await insertNotice(adultB.id, 'video:1');
    await expect(insertNotice(adultA.id, 'video:1')).rejects.toThrow(/duplicate|unique/i);
    await expect(insertNotice(adultA.id, 'video:2', 'surprise')).rejects.toThrow();
  });

  it('a notice for a kids profile is refused by the database', async () => {
    await expect(insertNotice(kidsA.id, 'video:9')).rejects.toThrow(/kids/i);
    await expect(
      t.pool.query(
        `INSERT INTO viewer_notices (profile_id, kind, title, href, dedupe_key) VALUES ($1, 'new_video', 'T', '/x', 'k')`,
        [kidsA.id],
      ),
    ).rejects.toThrow(/kids/i);
  });

  it('account A cannot read, update or delete account B notices, and no context sees zero rows', async () => {
    const own = await asRole(t.pool, 'ad_app', { accountId: accountA.id }, (c) =>
      c.query('SELECT profile_id FROM viewer_notices'),
    );
    expect(own.rows.length).toBe(1);
    expect(own.rows.every((r) => r.profile_id === adultA.id)).toBe(true);
    const updated = await asRole(t.pool, 'ad_app', { accountId: accountA.id }, (c) =>
      c.query('UPDATE viewer_notices SET read_at = now() WHERE profile_id = $1', [adultB.id]),
    );
    expect(updated.rowCount).toBe(0);
    const deleted = await asRole(t.pool, 'ad_app', { accountId: accountA.id }, (c) =>
      c.query('DELETE FROM viewer_notices WHERE profile_id = $1', [adultB.id]),
    );
    expect(deleted.rowCount).toBe(0);
    const none = await asRole(t.pool, 'ad_app', {}, (c) => c.query('SELECT 1 FROM viewer_notices'));
    expect(none.rowCount).toBe(0);
  });

  it('the app can mark read but cannot insert or edit the content of a notice', async () => {
    const marked = await asRole(t.pool, 'ad_app', { accountId: accountA.id }, (c) =>
      c.query('UPDATE viewer_notices SET read_at = now() WHERE profile_id = $1', [adultA.id]),
    );
    expect(marked.rowCount).toBe(1);
    await expect(
      asRole(t.pool, 'ad_app', { accountId: accountA.id }, (c) =>
        c.query("UPDATE viewer_notices SET title = 'changed' WHERE profile_id = $1", [adultA.id]),
      ),
    ).rejects.toThrow(/permission denied/);
    await expect(
      asRole(t.pool, 'ad_app', { accountId: accountA.id }, (c) =>
        c.query(
          `INSERT INTO viewer_notices (profile_id, kind, title, href, dedupe_key) VALUES ($1, 'new_video', 'T', '/x', 'own')`,
          [adultA.id],
        ),
      ),
    ).rejects.toThrow();
  });

  it('notices go when the profile or the account goes', async () => {
    await t.pool.query('DELETE FROM profiles WHERE id = $1', [adultB.id]);
    expect((await t.pool.query('SELECT 1 FROM viewer_notices WHERE profile_id = $1', [adultB.id])).rowCount).toBe(0);
  });

  it('preferences default to bell and both kinds on, email off, and are owned per account', async () => {
    await asRole(t.pool, 'ad_app', { accountId: accountA.id }, (c) =>
      c.query('INSERT INTO viewer_notification_prefs (account_id) VALUES ($1)', [accountA.id]),
    );
    const row = await asRole(t.pool, 'ad_app', { accountId: accountA.id }, (c) =>
      c.query('SELECT * FROM viewer_notification_prefs'),
    );
    expect(row.rows[0]).toMatchObject({
      bell: true,
      new_episodes: true,
      new_videos: true,
      email_frequency: 'off',
      address_enc: null,
      address_consented_at: null,
    });
    await expect(
      asRole(t.pool, 'ad_app', { accountId: accountA.id }, (c) =>
        c.query("UPDATE viewer_notification_prefs SET email_frequency = 'hourly'"),
      ),
    ).rejects.toThrow();
    await expect(
      asRole(t.pool, 'ad_app', { accountId: accountA.id }, (c) =>
        c.query('INSERT INTO viewer_notification_prefs (account_id) VALUES ($1)', [accountB.id]),
      ),
    ).rejects.toThrow();
    const other = await asRole(t.pool, 'ad_app', { accountId: accountB.id }, (c) =>
      c.query('SELECT 1 FROM viewer_notification_prefs'),
    );
    expect(other.rowCount).toBe(0);
  });

  it('the worker reads preferences but cannot change them', async () => {
    const read = await asRole(t.pool, 'ad_worker', {}, (c) => c.query('SELECT account_id FROM viewer_notification_prefs'));
    expect(read.rowCount).toBe(1);
    await expect(
      asRole(t.pool, 'ad_worker', {}, (c) => c.query('UPDATE viewer_notification_prefs SET bell = false')),
    ).rejects.toThrow(/permission denied/);
  });

  it('follower and audience functions return profile ids only, never kids, and honour the preferences', async () => {
    const series1 = '00000000-0000-7000-8000-0000000000a1';
    await t.db.insert(series).values({ id: series1, slug: 'followed-series', title: 'Followed' });
    await t.pool.query('INSERT INTO my_list (profile_id, series_id) VALUES ($1, $2)', [adultA.id, series1]);
    const followers = await asRole(t.pool, 'ad_worker', {}, (c) =>
      c.query('SELECT * FROM notice_followers($1, now() - interval \'120 days\')', [series1]),
    );
    expect(followers.rows).toEqual([{ profile_id: adultA.id, max_rank: 4 }]);
    await t.pool.query('UPDATE viewer_notification_prefs SET new_episodes = false WHERE account_id = $1', [accountA.id]);
    const off = await asRole(t.pool, 'ad_worker', {}, (c) =>
      c.query('SELECT * FROM notice_followers($1, now() - interval \'120 days\')', [series1]),
    );
    expect(off.rowCount).toBe(0);
    await t.pool.query('UPDATE viewer_notification_prefs SET new_episodes = true, new_videos = false WHERE account_id = $1', [accountA.id]);
    const audience = await asRole(t.pool, 'ad_worker', {}, (c) => c.query('SELECT * FROM notice_video_audience()'));
    expect(audience.rows.map((r) => r.profile_id)).not.toContain(adultA.id);
    expect(audience.rows.map((r) => r.profile_id)).not.toContain(kidsA.id);
    await t.pool.query('UPDATE viewer_notification_prefs SET new_videos = true WHERE account_id = $1', [accountA.id]);
    const on = await asRole(t.pool, 'ad_worker', {}, (c) => c.query('SELECT * FROM notice_video_audience()'));
    expect(on.rows.map((r) => r.profile_id)).toEqual([adultA.id]);
  });

  it('the backfill marks every video that is already live as announced and leaves drafts alone', async () => {
    const live = makeVideo({ status: 'ready', durationMs: 60000, publishState: 'published' });
    const draft = makeVideo({ status: 'ready', durationMs: 60000, publishState: 'draft' });
    await t.db.insert(videos).values([live, draft]);
    await t.pool.query('UPDATE videos SET announced_at = NULL');
    const dir = resolve(import.meta.dirname, '../migrations/main');
    const file = readdirSync(dir).find((f) => f.includes('viewer_notices'));
    expect(file).toBeTruthy();
    const statement = readFileSync(resolve(dir, file as string), 'utf8')
      .split('--> statement-breakpoint')
      .find((s) => /UPDATE\s+"?videos"?\s+SET\s+"?announced_at"?/i.test(s));
    expect(statement).toBeTruthy();
    await t.pool.query(statement as string);
    const rows = await t.pool.query('SELECT id, announced_at FROM videos');
    const byId = new Map(rows.rows.map((r) => [r.id, r.announced_at]));
    expect(byId.get(live.id)).not.toBeNull();
    expect(byId.get(draft.id)).toBeNull();
  });
});
