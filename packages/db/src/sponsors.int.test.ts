import { randomBytes } from 'node:crypto';
import { SPONSOR_STATUS_FIXTURES, uuidv7 } from '@ad/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { asRole, createTestDatabase, integrationEnabled, type TestDatabase } from './testing';

const FUTURE = "now() + interval '30 days'";
const PAST = "now() - interval '30 days'";

describe.skipIf(!integrationEnabled())('sponsor tables (migration 0039)', () => {
  let t: TestDatabase;
  const editorId = uuidv7();
  const staff = (role: string) => ({ accountId: editorId, actorRole: role });
  const anon = {};

  beforeAll(async () => {
    t = await createTestDatabase();
  });
  afterAll(async () => {
    await t?.drop();
  });

  async function sponsor(
    status: string,
    startsAt = 'null',
    endsAt = 'null',
    name = `Sponsor ${randomBytes(3).toString('hex')}`,
  ): Promise<string> {
    const id = uuidv7();
    await t.pool.query(
      `INSERT INTO sponsors (id, name, status, starts_at, ends_at) VALUES ($1, $2, $3::sponsor_status, ${startsAt}, ${endsAt})`,
      [id, name, status],
    );
    return id;
  }

  async function creative(sponsorId: string, extra = ''): Promise<string> {
    const id = uuidv7();
    await t.pool.query(
      `INSERT INTO sponsor_creatives (id, sponsor_id, headline, destination_url${extra ? ', ' + extra.split('=')[0] : ''})
       VALUES ($1, $2, 'Learn with us', 'https://example.com/a'${extra ? ', ' + extra.split('=')[1] : ''})`,
      [id, sponsorId],
    );
    return id;
  }

  const visible = (role: 'ad_app' | 'ad_worker', ctx: object, table: string) =>
    asRole(t.pool, role, ctx, async (c) => (await c.query(`SELECT id FROM ${table}`)).rows.map((r) => r.id as string));

  it('anonymous context cannot read a draft sponsor', async () => {
    const draft = await sponsor('draft');
    expect(await visible('ad_app', anon, 'sponsors')).not.toContain(draft);
  });

  it('anonymous context reads only live sponsors and creatives inside the window', async () => {
    const live = await sponsor('active', PAST, FUTURE);
    const scheduled = await sponsor('active', FUTURE, "now() + interval '60 days'");
    const ended = await sponsor('active', "now() - interval '60 days'", PAST);
    const paused = await sponsor('paused');
    const archived = await sponsor('archived');
    const cLive = await creative(live);
    const cScheduled = await creative(scheduled);
    const cEnded = await creative(ended);
    const cPaused = await creative(paused);
    const cArchived = await creative(archived);
    const sponsors = await visible('ad_app', anon, 'sponsors');
    expect(sponsors).toContain(live);
    for (const id of [scheduled, ended, paused, archived]) expect(sponsors).not.toContain(id);
    const creatives = await visible('ad_app', anon, 'sponsor_creatives');
    expect(creatives).toContain(cLive);
    for (const id of [cScheduled, cEnded, cPaused, cArchived]) expect(creatives).not.toContain(id);
  });

  it('an inactive creative of a live sponsor is hidden from anonymous readers', async () => {
    const s = await sponsor('active', PAST, FUTURE);
    const c = await creative(s, 'active=false');
    expect(await visible('ad_app', anon, 'sponsor_creatives')).not.toContain(c);
  });

  it('placements follow their creative', async () => {
    const live = await sponsor('active');
    const draft = await sponsor('draft');
    const cLive = await creative(live);
    const cDraft = await creative(draft);
    await t.pool.query("INSERT INTO sponsor_placements (creative_id, slot) VALUES ($1, 'home_banner'), ($2, 'home_banner')", [cLive, cDraft]);
    const rows = await asRole(t.pool, 'ad_app', anon, async (c) =>
      (await c.query('SELECT creative_id FROM sponsor_placements')).rows.map((r) => r.creative_id as string),
    );
    expect(rows).toContain(cLive);
    expect(rows).not.toContain(cDraft);
  });

  it('a viewer role cannot insert a sponsor', async () => {
    await expect(
      asRole(t.pool, 'ad_app', staff('viewer'), (c) =>
        c.query("INSERT INTO sponsors (name) VALUES ('Sneaky')"),
      ),
    ).rejects.toThrow(/row-level security/);
    await expect(
      asRole(t.pool, 'ad_app', anon, (c) => c.query("INSERT INTO sponsors (name) VALUES ('Sneaky')")),
    ).rejects.toThrow(/row-level security/);
  });

  it('an editor can insert and read a draft sponsor and its creative', async () => {
    const id = uuidv7();
    const cid = uuidv7();
    await t.pool.query("INSERT INTO accounts (id, email_hash, email_enc, password_hash, role) VALUES ($1, $2, $3, 'x', 'editor')", [
      editorId,
      randomBytes(32),
      randomBytes(48),
    ]);
    await asRole(t.pool, 'ad_app', staff('editor'), async (c) => {
      await c.query("INSERT INTO sponsors (id, name, created_by) VALUES ($1, 'Draft one', $2)", [id, editorId]);
      await c.query(
        "INSERT INTO sponsor_creatives (id, sponsor_id, headline, destination_url) VALUES ($1, $2, 'Hello', 'https://example.org')",
        [cid, id],
      );
      const read = await c.query('SELECT id FROM sponsors WHERE id = $1', [id]);
      expect(read.rowCount).toBe(1);
    });
  });

  it('only staff reach the private sponsor contact and notes', async () => {
    const s = await sponsor('active');
    await t.pool.query(
      'INSERT INTO sponsor_private (sponsor_id, contact_email_enc, notes) VALUES ($1, $2, $3)',
      [s, randomBytes(40), 'internal'],
    );
    const anonRows = await asRole(t.pool, 'ad_app', anon, async (c) => (await c.query('SELECT * FROM sponsor_private')).rowCount);
    expect(anonRows).toBe(0);
    const staffRows = await asRole(t.pool, 'ad_app', staff('admin'), async (c) =>
      (await c.query('SELECT * FROM sponsor_private WHERE sponsor_id = $1', [s])).rowCount,
    );
    expect(staffRows).toBe(1);
  });

  it('rejects http, relative and over long destination urls', async () => {
    const s = await sponsor('draft');
    for (const url of ['http://example.com', '/relative', 'javascript:alert(1)', `https://e.com/${'a'.repeat(500)}`]) {
      await expect(
        t.pool.query("INSERT INTO sponsor_creatives (sponsor_id, headline, destination_url) VALUES ($1, 'H', $2)", [s, url]),
      ).rejects.toThrow(/sponsor_creatives_destination/);
    }
  });

  it('enforces text lengths on creatives', async () => {
    const s = await sponsor('draft');
    await expect(
      t.pool.query("INSERT INTO sponsor_creatives (sponsor_id, headline, destination_url) VALUES ($1, $2, 'https://e.com')", [s, 'h'.repeat(61)]),
    ).rejects.toThrow(/sponsor_creatives_headline/);
    await expect(
      t.pool.query("INSERT INTO sponsor_creatives (sponsor_id, headline, body, destination_url) VALUES ($1, 'H', $2, 'https://e.com')", [s, 'b'.repeat(141)]),
    ).rejects.toThrow(/sponsor_creatives_body/);
  });

  it('rejects ends_at before starts_at', async () => {
    await expect(sponsor('draft', FUTURE, PAST)).rejects.toThrow(/sponsors_window/);
  });

  it('rejects an empty or over long name', async () => {
    await expect(t.pool.query("INSERT INTO sponsors (name) VALUES ('')")).rejects.toThrow(/sponsors_name/);
    await expect(t.pool.query('INSERT INTO sponsors (name) VALUES ($1)', ['n'.repeat(81)])).rejects.toThrow(/sponsors_name/);
  });

  it('the placement primary key blocks duplicates', async () => {
    const s = await sponsor('draft');
    const c = await creative(s);
    await t.pool.query("INSERT INTO sponsor_placements (creative_id, slot) VALUES ($1, 'title_card')", [c]);
    await expect(
      t.pool.query("INSERT INTO sponsor_placements (creative_id, slot) VALUES ($1, 'title_card')", [c]),
    ).rejects.toThrow(/duplicate key/);
  });

  it('the effective status function agrees with the TypeScript derivation for each state', async () => {
    for (const f of SPONSOR_STATUS_FIXTURES) {
      const { rows } = await t.pool.query<{ s: string }>(
        'SELECT sponsor_effective($1::sponsor_status, $2::timestamptz, $3::timestamptz, $4::timestamptz)::text AS s',
        [f.sponsor.status, f.sponsor.startsAt, f.sponsor.endsAt, f.at],
      );
      expect(rows[0]?.s, f.name).toBe(f.expected);
    }
  });

  it('the effective status view reports the derived state', async () => {
    const live = await sponsor('active', PAST, FUTURE);
    const ended = await sponsor('active', "now() - interval '60 days'", PAST);
    const { rows } = await t.pool.query<{ sponsor_id: string; effective_status: string }>('SELECT * FROM sponsor_effective_status');
    const map = new Map(rows.map((r) => [r.sponsor_id, r.effective_status]));
    expect(map.get(live)).toBe('live');
    expect(map.get(ended)).toBe('ended');
  });

  it('deleting a sponsor removes creatives and placements, but is blocked once daily stats exist', async () => {
    const clean = await sponsor('draft');
    const c = await creative(clean);
    await t.pool.query("INSERT INTO sponsor_placements (creative_id, slot) VALUES ($1, 'home_banner')", [c]);
    await t.pool.query('DELETE FROM sponsors WHERE id = $1', [clean]);
    expect((await t.pool.query('SELECT 1 FROM sponsor_creatives WHERE id = $1', [c])).rowCount).toBe(0);
    expect((await t.pool.query('SELECT 1 FROM sponsor_placements WHERE creative_id = $1', [c])).rowCount).toBe(0);

    const used = await sponsor('archived');
    const uc = await creative(used);
    await t.pool.query("SELECT sponsor_stats_bump(current_date, $1, $2, 'home_banner', 3, 1, 2)", [used, uc]);
    await expect(t.pool.query('DELETE FROM sponsors WHERE id = $1', [used])).rejects.toThrow(/foreign key|violates/);
    await t.pool.query('DELETE FROM sponsor_creatives WHERE id = $1', [uc]);
    const stats = await t.pool.query('SELECT impressions, clicks, reach FROM sponsor_daily_stats WHERE sponsor_id = $1', [used]);
    expect(stats.rows[0]).toEqual({ impressions: 3, clicks: 1, reach: 2 });
  });

  it('the stats bump adds to the same day and is the only write path for the web role', async () => {
    const s = await sponsor('active');
    const c = await creative(s);
    await asRole(t.pool, 'ad_app', anon, async (client) => {
      await client.query("SELECT sponsor_stats_bump(current_date, $1, $2, 'title_card', 1, 0, 0)", [s, c]);
      await client.query("SELECT sponsor_stats_bump(current_date, $1, $2, 'title_card', 2, 1, 0)", [s, c]);
    });
    const { rows } = await t.pool.query('SELECT impressions, clicks FROM sponsor_daily_stats WHERE creative_id = $1', [c]);
    expect(rows[0]).toEqual({ impressions: 3, clicks: 1 });
    const anonRead = await asRole(t.pool, 'ad_app', anon, async (client) =>
      (await client.query('SELECT * FROM sponsor_daily_stats')).rowCount,
    );
    expect(anonRead).toBe(0);
    await expect(
      asRole(t.pool, 'ad_app', anon, (client) =>
        client.query("INSERT INTO sponsor_daily_stats (day, sponsor_id, creative_id, slot) VALUES (current_date, $1, $2, 'home_banner')", [s, c]),
      ),
    ).rejects.toThrow(/permission denied|row-level/);
  });

  it('staff can read the daily stats for reports, a viewer cannot', async () => {
    const s = await sponsor('active');
    const c = await creative(s);
    await t.pool.query("SELECT sponsor_stats_bump(current_date, $1, $2, 'home_banner', 5, 2, 4)", [s, c]);
    const rows = await asRole(t.pool, 'ad_app', staff('admin'), async (client) =>
      (await client.query('SELECT impressions FROM sponsor_daily_stats WHERE creative_id = $1', [c])).rows,
    );
    expect(rows).toEqual([{ impressions: 5 }]);
    const viewerRows = await asRole(t.pool, 'ad_app', staff('viewer'), async (client) => {
      try {
        return (await client.query('SELECT 1 FROM sponsor_daily_stats')).rowCount;
      } catch {
        return 0;
      }
    });
    expect(viewerRows).toBe(0);
  });

  it('the worker can read live sponsors and bump stats but cannot edit sponsors', async () => {
    const s = await sponsor('active');
    const c = await creative(s);
    expect(await visible('ad_worker', {}, 'sponsors')).toContain(s);
    await asRole(t.pool, 'ad_worker', {}, (client) =>
      client.query("SELECT sponsor_stats_bump(current_date, $1, $2, 'home_banner', 1, 0, 0)", [s, c]),
    );
    await expect(
      asRole(t.pool, 'ad_worker', {}, (client) => client.query("UPDATE sponsors SET name = 'x'")),
    ).rejects.toThrow(/permission denied/);
  });

  it('accepts the sponsor asset purpose', async () => {
    const { rows } = await t.pool.query("SELECT 'sponsor'::asset_purpose::text AS p");
    expect(rows[0]?.p).toBe('sponsor');
  });
});
