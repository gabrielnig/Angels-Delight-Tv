import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { accounts, profiles, series, videos } from './schema';
import {
  createTestDatabase,
  integrationEnabled,
  makeAccount,
  makeProfile,
  makeVideo,
  type TestDatabase,
} from './testing';

const MIGRATIONS = resolve(import.meta.dirname, '../migrations/main');

function backfillStatements(): string[] {
  const file = readdirSync(MIGRATIONS).find((f) => f.endsWith('_maturity_ranks.sql'));
  if (!file) throw new Error('maturity migration missing');
  return readFileSync(resolve(MIGRATIONS, file), 'utf8')
    .split('--> statement-breakpoint')
    .map((s) => s.trim())
    .filter((s) => /^UPDATE\b/i.test(s));
}

describe.skipIf(!integrationEnabled())('graded maturity (migration maturity_ranks)', () => {
  let t: TestDatabase;
  beforeAll(async () => {
    t = await createTestDatabase();
  });
  afterAll(async () => {
    await t?.drop();
  });

  const kidsSafeOf = async (table: 'videos' | 'series', id: string) =>
    (await t.pool.query<{ kids_safe: boolean }>(`SELECT kids_safe FROM ${table} WHERE id = $1`, [id]))
      .rows[0]!.kids_safe;

  it('kids_safe follows maturity_rank through the trigger on insert and update', async () => {
    const rank0 = makeVideo({ maturityRank: 0, kidsSafe: false });
    const rank3 = makeVideo({ maturityRank: 3, kidsSafe: true });
    await t.db.insert(videos).values([rank0, rank3]);
    expect(await kidsSafeOf('videos', rank0.id)).toBe(true);
    expect(await kidsSafeOf('videos', rank3.id)).toBe(false);

    await t.pool.query('UPDATE videos SET maturity_rank = 2 WHERE id = $1', [rank0.id]);
    expect(await kidsSafeOf('videos', rank0.id)).toBe(false);
    await t.pool.query('UPDATE videos SET maturity_rank = 0 WHERE id = $1', [rank3.id]);
    expect(await kidsSafeOf('videos', rank3.id)).toBe(true);

    // A legacy writer that flips the old flag cannot break the equality while a rank is set.
    await t.pool.query('UPDATE videos SET kids_safe = true WHERE id = $1', [rank0.id]);
    expect(await kidsSafeOf('videos', rank0.id)).toBe(false);

    const rankedSeries = { id: rank0.id.replace(/.$/, '1'), slug: 'rs-one', title: 'S', maturityRank: 0 };
    await t.db.insert(series).values(rankedSeries);
    expect(await kidsSafeOf('series', rankedSeries.id)).toBe(true);
    await t.pool.query('UPDATE series SET maturity_rank = 4 WHERE id = $1', [rankedSeries.id]);
    expect(await kidsSafeOf('series', rankedSeries.id)).toBe(false);
  });

  it('keeps the legacy flag authoritative while the rank is null', async () => {
    const legacy = makeVideo({ kidsSafe: true });
    await t.db.insert(videos).values(legacy);
    expect(await kidsSafeOf('videos', legacy.id)).toBe(true);
    await t.pool.query('UPDATE videos SET kids_safe = false WHERE id = $1', [legacy.id]);
    expect(await kidsSafeOf('videos', legacy.id)).toBe(false);
  });

  it('backfill maps kids_safe to 0, older to 3, everything else to 2', async () => {
    const kids = makeVideo({ kidsSafe: true, suitability: 'kids' });
    const everyone = makeVideo({ kidsSafe: true, suitability: 'everyone' });
    const older = makeVideo({ kidsSafe: false, suitability: 'older' });
    const unset = makeVideo({ kidsSafe: false });
    const rows = [kids, everyone, older, unset];
    await t.db.insert(videos).values(rows);
    await t.pool.query('UPDATE videos SET maturity_rank = NULL WHERE id = ANY($1)', [
      rows.map((r) => r.id),
    ]);
    const legacySeries = { id: kids.id.replace(/.$/, '2'), slug: 'rs-legacy', title: 'L', kidsSafe: true };
    await t.db.insert(series).values(legacySeries);
    await t.pool.query('UPDATE series SET maturity_rank = NULL WHERE id = $1', [legacySeries.id]);

    for (const statement of backfillStatements()) await t.pool.query(statement);

    const rank = async (table: string, id: string) =>
      (await t.pool.query<{ r: number }>(`SELECT maturity_rank AS r FROM ${table} WHERE id = $1`, [id]))
        .rows[0]!.r;
    expect(await rank('videos', kids.id)).toBe(0);
    expect(await rank('videos', everyone.id)).toBe(0);
    expect(await rank('videos', older.id)).toBe(3);
    expect(await rank('videos', unset.id)).toBe(2);
    expect(await rank('series', legacySeries.id)).toBe(0);
    expect(await kidsSafeOf('videos', older.id)).toBe(false);
  });

  it('refuses ranks outside 0 to 4', async () => {
    await expect(t.db.insert(videos).values(makeVideo({ maturityRank: 5 }))).rejects.toThrow();
    await expect(t.db.insert(videos).values(makeVideo({ maturityRank: -1 }))).rejects.toThrow();
  });

  it('a kids profile limit is always 0, whatever a writer asks for, and an adult defaults to 4', async () => {
    const account = makeAccount();
    await t.db.insert(accounts).values(account);
    const adult = makeProfile(account.id, { isPrimary: true });
    await t.db.insert(profiles).values(adult);
    const limitOf = async (id: string) =>
      (
        await t.pool.query<{ max_maturity_rank: number }>(
          'SELECT max_maturity_rank FROM profiles WHERE id = $1',
          [id],
        )
      ).rows[0]!.max_maturity_rank;
    expect(await limitOf(adult.id)).toBe(4);

    const kids = makeProfile(account.id, { isKids: true, maxMaturityRank: 2, position: 1 });
    await t.db.insert(profiles).values(kids);
    expect(await limitOf(kids.id)).toBe(0);

    await t.pool.query('UPDATE profiles SET max_maturity_rank = 3 WHERE id = $1', [kids.id]);
    expect(await limitOf(kids.id)).toBe(0);

    const second = makeProfile(account.id, { position: 2, maxMaturityRank: 3 });
    await t.db.insert(profiles).values(second);
    expect(await limitOf(second.id)).toBe(3);
    await t.pool.query('UPDATE profiles SET is_kids = true WHERE id = $1', [second.id]);
    expect(await limitOf(second.id)).toBe(0);
  });

  it('refuses limits outside 0 to 4', async () => {
    const account = makeAccount();
    await t.db.insert(accounts).values(account);
    await expect(
      t.db.insert(profiles).values(makeProfile(account.id, { maxMaturityRank: 5 })),
    ).rejects.toThrow();
  });
});
