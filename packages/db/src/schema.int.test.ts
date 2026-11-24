import { uuidv7 } from '@ad/shared';
import { getTableName, is } from 'drizzle-orm';
import { PgTable } from 'drizzle-orm/pg-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as schema from './schema';
import {
  accounts,
  auditLog,
  categories,
  episodes,
  profiles,
  rows,
  rowItems,
  settings,
  videos,
} from './schema';
import {
  asRole,
  createTestDatabase,
  integrationEnabled,
  makeAccount,
  makeProfile,
  makeVideo,
  type TestDatabase,
} from './testing';

const MAIN_TABLES = [
  'account_deletions',
  'accounts',
  'admin_invites',
  'admin_notices',
  'analytics_counters',
  'assets',
  'audit_log',
  'auth_lockouts',
  'caption_tracks',
  'captions',
  'categories',
  'consents',
  'data_exports',
  'email_outbox',
  'email_suppressions',
  'email_tokens',
  'episodes',
  'jobs',
  'mfa_factors',
  'mfa_recovery_codes',
  'my_list',
  'profiles',
  'rate_limit_buckets',
  'renditions',
  'row_items',
  'rows',
  'search_history',
  'seasons',
  'series',
  'series_categories',
  'sessions',
  'settings',
  'signup_invites',
  'site_daily_stats',
  'slug_redirects',
  'staff_exports',
  'staff_notification_prefs',
  'theme_settings',
  'upload_sessions',
  'verification_codes',
  'video_categories',
  'video_chapters',
  'video_daily_stats',
  'video_keys',
  'video_markers',
  'videos',
  'view_events',
  'watch_progress',
  'watch_progress_removals',
  'worker_heartbeats',
];

describe('schema definition', () => {
  it('defines every table in docs/DATA-MODEL.md, with user_keys apart in the keys database', () => {
    const defined = Object.values(schema as Record<string, unknown>)
      .filter((value) => is(value, PgTable))
      .map((table) => getTableName(table as PgTable))
      .sort();
    expect(defined).toEqual([...MAIN_TABLES, 'user_keys'].sort());
  });
});

describe.skipIf(!integrationEnabled())('database constraints and triggers', () => {
  let t: TestDatabase;

  beforeAll(async () => {
    t = await createTestDatabase();
  });
  afterAll(async () => {
    await t?.drop();
  });

  const sqlState = (code: string) => expect.objectContaining({ code });

  it('creates every main table and keeps rate_limit_buckets unlogged', async () => {
    const tables = await t.pool.query(
      "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY 1",
    );
    expect(tables.rows.map((row) => row.tablename)).toEqual(MAIN_TABLES);
    const persistence = await t.pool.query(
      "SELECT relpersistence FROM pg_class WHERE relname = 'rate_limit_buckets'",
    );
    expect(persistence.rows[0].relpersistence).toBe('u');
  });

  it('puts user_keys in the keys database only', async () => {
    const keys = await t.keysPool.query(
      "SELECT tablename FROM pg_tables WHERE schemaname = 'public'",
    );
    expect(keys.rows.map((row) => row.tablename)).toEqual(['user_keys']);
  });

  describe('videos', () => {
    it('refuses to publish a video that is not ready', async () => {
      await expect(
        t.db.insert(videos).values(makeVideo({ publishState: 'published' })),
      ).rejects.toMatchObject({
        cause: sqlState('23514'),
      });
    });

    it('refuses a scheduled video without a publish time', async () => {
      await expect(
        t.db
          .insert(videos)
          .values(makeVideo({ status: 'ready', durationMs: 1000, publishState: 'scheduled' })),
      ).rejects.toMatchObject({ cause: sqlState('23514') });
    });

    it('refuses a ready video without a duration', async () => {
      await expect(
        t.db.insert(videos).values(makeVideo({ status: 'ready' })),
      ).rejects.toMatchObject({
        cause: sqlState('23514'),
      });
    });

    it('accepts a ready, published video', async () => {
      await t.db.insert(videos).values(
        makeVideo({
          status: 'ready',
          durationMs: 60_000,
          publishState: 'published',
          publishedAt: new Date(),
        }),
      );
    });

    it('rejects a slug that is not lowercase hyphenated', async () => {
      await expect(
        t.db.insert(videos).values(makeVideo({ slug: 'Bad Slug' })),
      ).rejects.toMatchObject({
        cause: sqlState('23514'),
      });
    });

    it('keeps slugs unique until the video is soft deleted', async () => {
      const first = makeVideo({ slug: 'fractions-intro' });
      await t.db.insert(videos).values(first);
      await expect(
        t.db.insert(videos).values(makeVideo({ slug: 'fractions-intro' })),
      ).rejects.toMatchObject({
        cause: sqlState('23505'),
      });
      await t.pool.query('UPDATE videos SET deleted_at = now() WHERE id = $1', [first.id]);
      await t.db.insert(videos).values(makeVideo({ slug: 'fractions-intro' }));
    });

    it('fills the generated search vector from title and description', async () => {
      await t.db
        .insert(videos)
        .values(makeVideo({ title: 'Understanding fractions', description: 'Parts of a whole' }));
      const hit = await t.pool.query(
        "SELECT count(*)::int AS n FROM videos WHERE search_tsv @@ plainto_tsquery('simple', 'fractions')",
      );
      expect(hit.rows[0].n).toBeGreaterThan(0);
    });

    it('maintains updated_at on update', async () => {
      const video = makeVideo();
      await t.db.insert(videos).values(video);
      const before = (await t.pool.query('SELECT updated_at FROM videos WHERE id = $1', [video.id]))
        .rows[0].updated_at;
      await new Promise((resolve) => setTimeout(resolve, 15));
      await t.pool.query("UPDATE videos SET title = 'Renamed' WHERE id = $1", [video.id]);
      const after = (await t.pool.query('SELECT updated_at FROM videos WHERE id = $1', [video.id]))
        .rows[0].updated_at;
      expect(after.getTime()).toBeGreaterThan(before.getTime());
    });
  });

  describe('episodes', () => {
    it('only accepts a video whose kind is episode', async () => {
      const standalone = makeVideo();
      await t.db.insert(videos).values(standalone);
      const seriesId = uuidv7();
      const seasonId = uuidv7();
      await t.pool.query("INSERT INTO series (id, slug, title) VALUES ($1, $2, 'Show')", [
        seriesId,
        `show-${seriesId.slice(-8)}`,
      ]);
      await t.pool.query('INSERT INTO seasons (id, series_id, number) VALUES ($1, $2, 1)', [
        seasonId,
        seriesId,
      ]);
      await expect(
        t.db.insert(episodes).values({ seasonId, videoId: standalone.id, number: 1 }),
      ).rejects.toMatchObject({ cause: sqlState('23503') });

      const episodeVideo = makeVideo({ kind: 'episode' });
      await t.db.insert(videos).values(episodeVideo);
      await t.db.insert(episodes).values({ seasonId, videoId: episodeVideo.id, number: 1 });
    });
  });

  describe('rows and row_items', () => {
    it('lets two rows swap positions inside one transaction', async () => {
      const a = uuidv7();
      const b = uuidv7();
      await t.db.insert(rows).values([
        { id: a, title: 'A', position: 101 },
        { id: b, title: 'B', position: 102 },
      ]);
      const client = await t.pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('UPDATE rows SET position = 102 WHERE id = $1', [a]);
        await client.query('UPDATE rows SET position = 101 WHERE id = $1', [b]);
        await client.query('COMMIT');
      } finally {
        client.release();
      }
      const result = await t.pool.query(
        'SELECT id, position FROM rows WHERE id = ANY($1) ORDER BY position',
        [[a, b]],
      );
      expect(result.rows.map((row) => row.id)).toEqual([b, a]);
    });

    it('still rejects a duplicate position at commit', async () => {
      await t.db.insert(rows).values({ title: 'C', position: 201 });
      await expect(t.db.insert(rows).values({ title: 'D', position: 201 })).rejects.toMatchObject({
        cause: sqlState('23505'),
      });
    });

    it('requires a category for a category row', async () => {
      await expect(
        t.db.insert(rows).values({ title: 'Cat', kind: 'category', position: 301 }),
      ).rejects.toMatchObject({
        cause: sqlState('23514'),
      });
    });

    it('requires exactly one target on a row item', async () => {
      const rowId = uuidv7();
      await t.db.insert(rows).values({ id: rowId, title: 'Picks', position: 401 });
      await expect(t.db.insert(rowItems).values({ rowId, position: 1 })).rejects.toMatchObject({
        cause: sqlState('23514'),
      });
    });
  });

  describe('categories', () => {
    it('treats names as case insensitive', async () => {
      await t.db.insert(categories).values({ slug: 'science', name: 'Science' });
      await expect(
        t.db.insert(categories).values({ slug: 'science-2', name: 'SCIENCE' }),
      ).rejects.toMatchObject({
        cause: sqlState('23505'),
      });
    });
  });

  describe('profiles', () => {
    async function accountWithProfiles(count: number) {
      const account = makeAccount();
      await t.db.insert(accounts).values(account);
      for (let index = 0; index < count; index++) {
        await t.db.insert(profiles).values(makeProfile(account.id, { position: index }));
      }
      return account;
    }

    const addProfile = (accountId: string) =>
      asRole(t.pool, 'ad_app', { accountId, actorRole: 'viewer' }, (client) =>
        client.query(
          'INSERT INTO profiles (id, account_id, name_enc, avatar_id) VALUES ($1, $2, $3, $4)',
          [uuidv7(), accountId, Buffer.from('n'), 'sun'],
        ),
      );

    it('refuses a sixth profile by default', async () => {
      const account = await accountWithProfiles(5);
      await expect(addProfile(account.id)).rejects.toThrow(/profile limit/);
    });

    it('allows a fifth profile', async () => {
      const account = await accountWithProfiles(4);
      await addProfile(account.id);
    });

    it('follows limits.max_profiles from settings', async () => {
      await t.db.insert(settings).values({ key: 'limits.max_profiles', value: 2 });
      const account = await accountWithProfiles(2);
      await expect(addProfile(account.id)).rejects.toThrow(/profile limit/);
      await t.pool.query("DELETE FROM settings WHERE key = 'limits.max_profiles'");
    });

    it('does not allow a kids profile to be primary', async () => {
      const account = makeAccount();
      await t.db.insert(accounts).values(account);
      await expect(
        t.db.insert(profiles).values(makeProfile(account.id, { isKids: true, isPrimary: true })),
      ).rejects.toMatchObject({ cause: sqlState('23514') });
    });
  });

  describe('accounts', () => {
    it('refuses to demote the last active admin', async () => {
      await t.pool.query("DELETE FROM accounts WHERE role = 'admin'");
      const onlyAdmin = makeAccount({ role: 'admin' });
      await t.db.insert(accounts).values(onlyAdmin);
      await expect(
        t.pool.query("UPDATE accounts SET role = 'viewer' WHERE id = $1", [onlyAdmin.id]),
      ).rejects.toThrow(/last active admin/);
    });

    it('allows demoting an admin when another active admin remains', async () => {
      const second = makeAccount({ role: 'admin' });
      await t.db.insert(accounts).values(second);
      const result = await t.pool.query("UPDATE accounts SET role = 'viewer' WHERE id = $1", [
        second.id,
      ]);
      expect(result.rowCount).toBe(1);
    });

    it('sees other admins even when the caller can only see its own row', async () => {
      const keeper = makeAccount({ role: 'admin' });
      const leaving = makeAccount({ role: 'admin' });
      await t.db.insert(accounts).values([keeper, leaving]);
      await asRole(t.pool, 'ad_app', { accountId: leaving.id, actorRole: 'admin' }, (client) =>
        client.query("UPDATE accounts SET status = 'suspended' WHERE id = $1", [leaving.id]),
      );
    });

    it('requires credentials on a live account and clears them on a deleted one', async () => {
      await expect(
        t.db
          .insert(accounts)
          .values({ id: uuidv7(), emailHash: null, emailEnc: null, passwordHash: null }),
      ).rejects.toMatchObject({ cause: sqlState('23514') });
      await t.db.insert(accounts).values({
        id: uuidv7(),
        status: 'deleted',
        deletedAt: new Date(),
        emailHash: null,
        emailEnc: null,
        passwordHash: null,
      });
    });
  });

  describe('audit_log', () => {
    it('accepts inserts from the app role and rejects update and delete from anyone else', async () => {
      await asRole(t.pool, 'ad_app', {}, (client) =>
        client.query(
          "INSERT INTO audit_log (action, outcome) VALUES ('auth.login.failed', 'failure')",
        ),
      );
      await expect(t.pool.query("UPDATE audit_log SET outcome = 'success'")).rejects.toThrow(
        /append only/,
      );
      await expect(t.pool.query('DELETE FROM audit_log')).rejects.toThrow(/append only/);
      await expect(t.pool.query('TRUNCATE audit_log')).rejects.toThrow(/append only/);
      await expect(
        asRole(t.pool, 'ad_app', {}, (client) => client.query('DELETE FROM audit_log')),
      ).rejects.toThrow(/permission denied/);
    });

    it('lets the maintenance role prune old rows', async () => {
      await t.db
        .insert(auditLog)
        .values({ action: 'old.event', outcome: 'success', occurredAt: new Date('2020-01-01') });
      const result = await asRole(t.pool, 'ad_maintenance', {}, (client) =>
        client.query("DELETE FROM audit_log WHERE action = 'old.event'"),
      );
      expect(result.rowCount).toBe(1);
    });

    it('rejects an outcome outside success, denied and failure', async () => {
      await expect(
        t.db.insert(auditLog).values({ action: 'x', outcome: 'maybe' }),
      ).rejects.toMatchObject({
        cause: sqlState('23514'),
      });
    });
  });

  describe('pipeline tables', () => {
    it('allows only one open job per queue and video', async () => {
      const video = makeVideo();
      await t.db.insert(videos).values(video);
      await t.pool.query(
        "INSERT INTO jobs (queue, video_id, status) VALUES ('video.encode', $1, 'queued')",
        [video.id],
      );
      await expect(
        t.pool.query(
          "INSERT INTO jobs (queue, video_id, status) VALUES ('video.encode', $1, 'running')",
          [video.id],
        ),
      ).rejects.toMatchObject({ code: '23505' });
      await t.pool.query("UPDATE jobs SET status = 'succeeded' WHERE video_id = $1", [video.id]);
      await t.pool.query(
        "INSERT INTO jobs (queue, video_id, status) VALUES ('video.encode', $1, 'queued')",
        [video.id],
      );
    });

    it('rejects an upload session over 16 GiB or with parts under 5 MiB', async () => {
      const creator = makeAccount();
      await t.db.insert(accounts).values(creator);
      const insert = (size: number, part: number) =>
        t.pool.query(
          `INSERT INTO upload_sessions (kind, created_by, filename, declared_mime, size_bytes, part_size_bytes, total_parts, storage_key, s3_upload_id, fingerprint, expires_at)
           VALUES ('video', $1, 'a.mp4', 'video/mp4', $2, $3, 1, 'k', 'u', $4, now() + interval '2 days')`,
          [creator.id, size, part, uuidv7()],
        );
      await expect(insert(17_179_869_185, 8_388_608)).rejects.toMatchObject({ code: '23514' });
      await expect(insert(1_000_000, 1_000_000)).rejects.toMatchObject({ code: '23514' });
      await insert(1_000_000, 8_388_608);
    });
  });

  describe('view_events', () => {
    it('never stores a profile for the kids audience', async () => {
      const account = makeAccount();
      const profile = makeProfile(account.id, { isKids: true });
      const video = makeVideo();
      await t.db.insert(accounts).values(account);
      await t.db.insert(profiles).values(profile);
      await t.db.insert(videos).values(video);
      const insert = (audience: string, profileId: string | null) =>
        t.pool.query(
          'INSERT INTO view_events (play_id, video_id, profile_id, audience, started_at, watched_ms) VALUES ($1, $2, $3, $4, now(), 10)',
          [uuidv7(), video.id, profileId, audience],
        );
      await expect(insert('kids', profile.id)).rejects.toMatchObject({ code: '23514' });
      await insert('kids', null);
    });
  });

  describe('keys database', () => {
    it('lets the app role read and create keys but not delete them', async () => {
      const accountId = uuidv7();
      await asRole(t.keysPool, 'ad_keys_app', {}, (client) =>
        client.query(
          'INSERT INTO user_keys (account_id, dek_wrapped, kek_version) VALUES ($1, $2, 1)',
          [accountId, Buffer.alloc(60)],
        ),
      );
      await expect(
        asRole(t.keysPool, 'ad_keys_app', {}, (client) =>
          client.query('DELETE FROM user_keys WHERE account_id = $1', [accountId]),
        ),
      ).rejects.toThrow(/permission denied/);
    });

    it('lets the shred role delete a key but not read wrapped keys', async () => {
      const accountId = uuidv7();
      await t.keysPool.query(
        'INSERT INTO user_keys (account_id, dek_wrapped, kek_version) VALUES ($1, $2, 1)',
        [accountId, Buffer.alloc(60)],
      );
      await expect(
        asRole(t.keysPool, 'ad_keys_shred', {}, (client) =>
          client.query('SELECT dek_wrapped FROM user_keys'),
        ),
      ).rejects.toThrow(/permission denied/);
      const result = await asRole(t.keysPool, 'ad_keys_shred', {}, (client) =>
        client.query('DELETE FROM user_keys WHERE account_id = $1', [accountId]),
      );
      expect(result.rowCount).toBe(1);
    });
  });
});
