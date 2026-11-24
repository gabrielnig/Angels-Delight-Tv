import { randomBytes } from 'node:crypto';
import { uuidv7 } from '@ad/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { asRole, createTestDatabase, integrationEnabled, type TestDatabase } from './testing';

describe.skipIf(!integrationEnabled())('sponsor tracking function (migration 0041)', () => {
  let t: TestDatabase;
  beforeAll(async () => {
    t = await createTestDatabase();
  });
  afterAll(async () => {
    await t?.drop();
  });

  async function creative(status = 'active', slot: string | null = 'home_banner') {
    const s = uuidv7();
    const c = uuidv7();
    await t.pool.query('INSERT INTO sponsors (id, name, status) VALUES ($1, $2, $3::sponsor_status)', [s, `S${randomBytes(2).toString('hex')}`, status]);
    await t.pool.query("INSERT INTO sponsor_creatives (id, sponsor_id, headline, destination_url) VALUES ($1, $2, 'H', 'https://e.com')", [c, s]);
    if (slot) await t.pool.query('INSERT INTO sponsor_placements (creative_id, slot) VALUES ($1, $2::sponsor_slot)', [c, slot]);
    return { s, c };
  }
  const track = (c: string, slot: string, hash: string | null, kind: 'imp' | 'clk') =>
    asRole(t.pool, 'ad_app', {}, async (client) =>
      (await client.query<{ r: boolean }>("SELECT sponsor_track(current_date, $1, $2::sponsor_slot, $3, $4) AS r", [c, slot, hash, kind])).rows[0]?.r,
    );
  const stats = async (c: string) =>
    (await t.pool.query('SELECT impressions, clicks, reach FROM sponsor_daily_stats WHERE creative_id = $1', [c])).rows[0];

  it('counts an impression and a distinct viewer once per day', async () => {
    const { c } = await creative();
    expect(await track(c, 'home_banner', 'aaa', 'imp')).toBe(true);
    await track(c, 'home_banner', 'aaa', 'imp');
    await track(c, 'home_banner', 'bbb', 'imp');
    expect(await stats(c)).toEqual({ impressions: 3, clicks: 0, reach: 2 });
  });

  it('counts a click without reach', async () => {
    const { c } = await creative();
    await track(c, 'home_banner', null, 'clk');
    expect(await stats(c)).toEqual({ impressions: 0, clicks: 1, reach: 0 });
  });

  it('records nothing for a sponsor that is not live, a missing placement or an unknown creative', async () => {
    const draft = await creative('draft');
    const noSlot = await creative('active', 'title_card');
    expect(await track(draft.c, 'home_banner', 'x', 'imp')).toBe(false);
    expect(await track(noSlot.c, 'home_banner', 'x', 'imp')).toBe(false);
    expect(await track(uuidv7(), 'home_banner', 'x', 'imp')).toBe(false);
    expect(await stats(draft.c)).toBeUndefined();
    expect(await stats(noSlot.c)).toBeUndefined();
  });

  it('the reach table is closed to the web role and pruned by the worker', async () => {
    const { c } = await creative();
    await track(c, 'home_banner', 'old', 'imp');
    await expect(asRole(t.pool, 'ad_app', {}, (client) => client.query('SELECT * FROM sponsor_reach_seen'))).rejects.toThrow(/permission denied/);
    await t.pool.query("UPDATE sponsor_reach_seen SET day = current_date - 5");
    const deleted = await asRole(t.pool, 'ad_worker', {}, async (client) => (await client.query<{ n: number }>('SELECT sponsor_reach_prune() AS n')).rows[0]?.n);
    expect(deleted).toBeGreaterThanOrEqual(1);
    expect((await t.pool.query('SELECT 1 FROM sponsor_reach_seen')).rowCount).toBe(0);
  });
});
