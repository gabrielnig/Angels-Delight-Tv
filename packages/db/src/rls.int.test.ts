import { uuidv7 } from '@ad/shared';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { accounts, myList, profiles, watchProgress } from './schema';
import { withAccount } from './rls';
import {
  asRole,
  createTestDatabase,
  integrationEnabled,
  makeAccount,
  makeProfile,
  makeVideo,
  type TestDatabase,
} from './testing';
import { videos } from './schema';

describe.skipIf(!integrationEnabled())('row level security', () => {
  let t: TestDatabase;
  const alice = makeAccount();
  const bob = makeAccount();
  const admin = makeAccount({ role: 'admin' });
  const aliceProfile = makeProfile(alice.id, { isPrimary: true });
  const bobProfile = makeProfile(bob.id, { isPrimary: true });
  const video = makeVideo();

  beforeAll(async () => {
    t = await createTestDatabase();
    await t.db.insert(accounts).values([alice, bob, admin]);
    await t.db.insert(profiles).values([aliceProfile, bobProfile]);
    await t.db.insert(videos).values(video);
    await t.db.insert(watchProgress).values([
      { profileId: aliceProfile.id, videoId: video.id, positionMs: 1000, durationMs: 60000 },
      { profileId: bobProfile.id, videoId: video.id, positionMs: 2000, durationMs: 60000 },
    ]);
    await t.db.insert(myList).values([
      { profileId: aliceProfile.id, videoId: video.id },
      { profileId: bobProfile.id, videoId: video.id },
    ]);
  });

  afterAll(async () => {
    await t?.drop();
  });

  const count = async (client: pg.PoolClient, table: string) =>
    Number((await client.query(`SELECT count(*) AS n FROM ${table}`)).rows[0].n);

  describe('with no context', () => {
    it.each(['accounts', 'profiles', 'watch_progress', 'my_list'])(
      'shows zero rows in %s',
      async (table) => {
        await asRole(t.pool, 'ad_app', {}, async (client) => {
          expect(await count(client, table)).toBe(0);
        });
      },
    );

    it('still shows zero rows, without a cast error, on a pooled connection after an earlier context', async () => {
      const client = await t.pool.connect();
      try {
        await client.query('BEGIN');
        await client.query("SELECT set_config('app.account_id', $1, true)", [alice.id]);
        await client.query('COMMIT');
        await client.query('BEGIN');
        await client.query('SET LOCAL ROLE ad_app');
        expect(await count(client, 'accounts')).toBe(0);
        await client.query('COMMIT');
      } finally {
        client.release();
      }
    });
  });

  describe('as one account', () => {
    it('sees only its own account, profiles, progress and list', async () => {
      await asRole(
        t.pool,
        'ad_app',
        { accountId: alice.id, actorRole: 'viewer' },
        async (client) => {
          expect(await count(client, 'accounts')).toBe(1);
          expect(await count(client, 'profiles')).toBe(1);
          expect(await count(client, 'watch_progress')).toBe(1);
          expect(await count(client, 'my_list')).toBe(1);
        },
      );
    });

    it("cannot update another account's profile", async () => {
      await asRole(
        t.pool,
        'ad_app',
        { accountId: alice.id, actorRole: 'viewer' },
        async (client) => {
          const result = await client.query('UPDATE profiles SET avatar_id = $1 WHERE id = $2', [
            'moon',
            bobProfile.id,
          ]);
          expect(result.rowCount).toBe(0);
        },
      );
    });

    it("cannot delete another account's progress or list entries", async () => {
      await asRole(
        t.pool,
        'ad_app',
        { accountId: alice.id, actorRole: 'viewer' },
        async (client) => {
          expect(
            (
              await client.query('DELETE FROM watch_progress WHERE profile_id = $1', [
                bobProfile.id,
              ])
            ).rowCount,
          ).toBe(0);
          expect(
            (await client.query('DELETE FROM my_list WHERE profile_id = $1', [bobProfile.id]))
              .rowCount,
          ).toBe(0);
        },
      );
    });

    it('cannot create a profile under another account', async () => {
      await expect(
        asRole(t.pool, 'ad_app', { accountId: alice.id, actorRole: 'viewer' }, (client) =>
          client.query(
            'INSERT INTO profiles (id, account_id, name_enc, avatar_id) VALUES ($1, $2, $3, $4)',
            [uuidv7(), bob.id, Buffer.from('x'), 'sun'],
          ),
        ),
      ).rejects.toThrow(/row-level security/);
    });

    it("cannot write progress for another account's profile", async () => {
      await expect(
        asRole(t.pool, 'ad_app', { accountId: alice.id, actorRole: 'viewer' }, (client) =>
          client.query(
            'INSERT INTO watch_progress (profile_id, video_id, position_ms, duration_ms) VALUES ($1, $2, 1, 1)',
            [bobProfile.id, video.id],
          ),
        ),
      ).rejects.toThrow(/row-level security/);
    });

    it('cannot add to the list of a profile it does not own', async () => {
      await expect(
        asRole(t.pool, 'ad_app', { accountId: alice.id, actorRole: 'viewer' }, (client) =>
          client.query('INSERT INTO my_list (profile_id, video_id) VALUES ($1, $2)', [
            bobProfile.id,
            video.id,
          ]),
        ),
      ).rejects.toThrow(/row-level security/);
    });

    it('can write progress for its own profile', async () => {
      await asRole(
        t.pool,
        'ad_app',
        { accountId: alice.id, actorRole: 'viewer' },
        async (client) => {
          const result = await client.query(
            'UPDATE watch_progress SET position_ms = 5000 WHERE profile_id = $1 AND video_id = $2',
            [aliceProfile.id, video.id],
          );
          expect(result.rowCount).toBe(1);
        },
      );
    });
  });

  describe('as an admin context', () => {
    it('reads every account and profile', async () => {
      await asRole(
        t.pool,
        'ad_app',
        { accountId: admin.id, actorRole: 'admin' },
        async (client) => {
          expect(await count(client, 'accounts')).toBe(3);
          expect(await count(client, 'profiles')).toBe(2);
        },
      );
    });

    it('cannot change a profile it does not own', async () => {
      await asRole(
        t.pool,
        'ad_app',
        { accountId: admin.id, actorRole: 'admin' },
        async (client) => {
          const result = await client.query('UPDATE profiles SET avatar_id = $1 WHERE id = $2', [
            'moon',
            aliceProfile.id,
          ]);
          expect(result.rowCount).toBe(0);
        },
      );
    });

    it('does not see progress or list rows of viewers', async () => {
      await asRole(
        t.pool,
        'ad_app',
        { accountId: admin.id, actorRole: 'admin' },
        async (client) => {
          expect(await count(client, 'watch_progress')).toBe(0);
          expect(await count(client, 'my_list')).toBe(0);
        },
      );
    });
  });

  describe('worker role', () => {
    it.each(['accounts', 'profiles', 'sessions', 'email_tokens', 'mfa_factors', 'consents'])(
      'has no access to %s',
      async (table) => {
        await expect(
          asRole(t.pool, 'ad_worker', {}, (client) => count(client, table)),
        ).rejects.toThrow(/permission denied/);
      },
    );

    it('can read settings and write pipeline tables', async () => {
      await asRole(t.pool, 'ad_worker', {}, async (client) => {
        await count(client, 'settings');
        const result = await client.query('UPDATE videos SET failure_code = $1 WHERE id = $2', [
          'probe',
          video.id,
        ]);
        expect(result.rowCount).toBe(1);
      });
    });
  });

  describe('auth_find_account', () => {
    it('returns only the sign in fields for a known hash, with no context set', async () => {
      await asRole(t.pool, 'ad_app', {}, async (client) => {
        const result = await client.query('SELECT * FROM auth_find_account($1)', [alice.emailHash]);
        expect(result.rows).toHaveLength(1);
        expect(Object.keys(result.rows[0]).sort()).toEqual([
          'id',
          'password_hash',
          'role',
          'status',
        ]);
        expect(result.rows[0].id).toBe(alice.id);
      });
    });

    it('returns nothing for an unknown hash', async () => {
      await asRole(t.pool, 'ad_app', {}, async (client) => {
        const result = await client.query('SELECT * FROM auth_find_account($1)', [
          Buffer.alloc(32, 1),
        ]);
        expect(result.rows).toHaveLength(0);
      });
    });

    it('is not callable by the worker role', async () => {
      await expect(
        asRole(t.pool, 'ad_worker', {}, (client) =>
          client.query('SELECT * FROM auth_find_account($1)', [alice.emailHash]),
        ),
      ).rejects.toThrow(/permission denied/);
    });
  });

  describe('withAccount against a real app role connection', () => {
    let appPool: pg.Pool;

    beforeAll(() => {
      appPool = new pg.Pool({ connectionString: t.url, max: 1, options: '-c role=ad_app' });
    });
    afterAll(async () => {
      await appPool?.end();
    });

    it('applies the actor context and does not leak it to the next call on the same connection', async () => {
      const appDb = drizzle(appPool);
      const first = await withAccount(appDb, { accountId: alice.id, role: 'viewer' }, (tx) =>
        tx.select({ id: accounts.id }).from(accounts),
      );
      expect(first.map((row) => row.id)).toEqual([alice.id]);

      const second = await appDb.select({ id: accounts.id }).from(accounts);
      expect(second).toEqual([]);
    });

    it('sees a different account on the next call with a different actor', async () => {
      const appDb = drizzle(appPool);
      const rows = await withAccount(appDb, { accountId: bob.id, role: 'viewer' }, (tx) =>
        tx.execute(sql`select id from profiles`),
      );
      expect(rows.rows.map((row) => row.id)).toEqual([bobProfile.id]);
    });
  });
});
