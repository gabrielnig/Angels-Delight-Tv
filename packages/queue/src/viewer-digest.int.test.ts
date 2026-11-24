import { randomBytes } from 'node:crypto';
import { createDb, schema } from '@ad/db';
import {
  createTestDatabase,
  integrationEnabled,
  makeAccount,
  makeProfile,
  type TestDatabase,
} from '@ad/db/testing';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { openAddress } from './outbox';
import {
  buildViewerDigests,
  isDigestDay,
  sealViewerAddress,
  signUnsubscribeToken,
  verifyUnsubscribeToken,
} from './viewer-digest';

const kek = new Uint8Array(randomBytes(32));
// Tuesday 07:25 in Lagos (06:25 UTC), and the Monday before it.
const TUESDAY = new Date('2026-11-24T06:25:00Z');
const MONDAY = new Date('2026-11-23T06:25:00Z');

describe('digest day rules', () => {
  it('daily runs every day, weekly only on Monday in Lagos', () => {
    expect(isDigestDay('daily', TUESDAY)).toBe(true);
    expect(isDigestDay('weekly', TUESDAY)).toBe(false);
    expect(isDigestDay('weekly', MONDAY)).toBe(true);
    expect(isDigestDay('weekly', new Date('2026-11-22T23:30:00Z'))).toBe(true);
  });
});

describe('unsubscribe tokens', () => {
  const account = '0194a000-0000-7000-8000-000000000001';
  it('round trips for one account, expires, and is single purpose', () => {
    const token = signUnsubscribeToken(kek, account, TUESDAY);
    expect(verifyUnsubscribeToken(kek, token, TUESDAY)).toBe(account);
    expect(verifyUnsubscribeToken(kek, token, new Date(TUESDAY.getTime() + 400 * 86_400_000))).toBeNull();
    expect(verifyUnsubscribeToken(kek, `${token}x`, TUESDAY)).toBeNull();
    expect(verifyUnsubscribeToken(new Uint8Array(randomBytes(32)), token, TUESDAY)).toBeNull();
    expect(verifyUnsubscribeToken(kek, 'garbage', TUESDAY)).toBeNull();
    const other = signUnsubscribeToken(kek, account, TUESDAY).split('.');
    expect(verifyUnsubscribeToken(kek, `${other[0]}.`, TUESDAY)).toBeNull();
  });
});

describe.skipIf(!integrationEnabled())('viewer digest (M44-S15)', () => {
  let t: TestDatabase;
  let workerPool: TestDatabase['pool'];
  let worker: ReturnType<typeof createDb>;

  beforeAll(async () => {
    t = await createTestDatabase();
    const PoolClass = t.pool.constructor as new (config: object) => TestDatabase['pool'];
    workerPool = new PoolClass({ connectionString: t.url, max: 2, options: '-c role=ad_worker' });
    worker = createDb(workerPool);
  });
  afterAll(async () => {
    await workerPool?.end();
    await t?.drop();
  });
  beforeEach(async () => {
    await t.pool.query('DELETE FROM email_outbox');
    await t.pool.query('DELETE FROM viewer_notices');
    await t.pool.query('DELETE FROM viewer_notification_prefs');
  });

  async function household(
    address: string | null,
    frequency: 'off' | 'daily' | 'weekly',
    primaryRank = 4,
  ) {
    const account = makeAccount();
    await t.db.insert(schema.accounts).values(account);
    const primary = makeProfile(account.id, { isPrimary: true, maxMaturityRank: primaryRank });
    const second = makeProfile(account.id, { position: 1 });
    const kids = makeProfile(account.id, { isKids: true, position: 2, maxMaturityRank: 0 });
    await t.db.insert(schema.profiles).values([primary, second, kids]);
    await t.db.insert(schema.viewerNotificationPrefs).values({
      accountId: account.id,
      emailFrequency: frequency,
      addressEnc: address ? sealViewerAddress(kek, account.id, address) : null,
      addressConsentedAt: address ? new Date() : null,
    });
    return { accountId: account.id, primary: primary.id, second: second.id, kids: kids.id };
  }

  async function notice(profileId: string, title: string, rank = 0, ageMinutes = 5) {
    await t.pool.query(
      `INSERT INTO viewer_notices (profile_id, kind, title, href, dedupe_key, rank, created_at)
       VALUES ($1, 'new_video', $2, '/browse', $3, $4, now() - make_interval(mins => $5))`,
      [profileId, title, `k:${title}`, rank, ageMinutes],
    );
  }

  const outbox = async () =>
    (await t.pool.query('SELECT kind, vars, dedupe_key, recipient_id, to_enc, id FROM email_outbox ORDER BY created_at')).rows;

  it('queues one daily email per account with a dedupe key, merging the profiles and marking notices emailed', async () => {
    const home = await household('amina@example.org', 'daily');
    await notice(home.primary, 'Alpha');
    await notice(home.second, 'Beta');
    const result = await buildViewerDigests({ db: worker, kek, now: TUESDAY });
    expect(result).toMatchObject({ queued: 1 });
    const [row] = await outbox();
    expect(row).toMatchObject({ kind: 'viewer_digest_daily', recipient_id: home.accountId });
    expect(row.dedupe_key).toBe(`viewer-digest:${home.accountId}:2026-11-24`);
    expect(String(row.vars.lines).split('\n').sort()).toEqual(['Alpha', 'Beta']);
    expect(row.vars.accountId).toBe(home.accountId);
    expect(openAddress(kek, `outbox:${row.id}`, row.to_enc)).toBe('amina@example.org');
    const left = await t.pool.query('SELECT 1 FROM viewer_notices WHERE emailed_at IS NULL');
    expect(left.rowCount).toBe(0);
    expect((await buildViewerDigests({ db: worker, kek, now: TUESDAY })).queued).toBe(0);
    expect(await outbox()).toHaveLength(1);
  });

  it('sends at most 10 lines and says how many more', async () => {
    const home = await household('a@example.org', 'daily');
    for (let i = 0; i < 14; i += 1) await notice(home.primary, `T${String(i).padStart(2, '0')}`, 0, i + 1);
    await buildViewerDigests({ db: worker, kek, now: TUESDAY });
    const lines = String((await outbox())[0]?.vars.lines).split('\n');
    expect(lines).toHaveLength(10);
    expect(lines[9]).toBe('and 5 more');
  });

  it('skips accounts with email off or no stored address, and sends nothing when there are no notices', async () => {
    const off = await household('a@example.org', 'off');
    const none = await household(null, 'daily');
    await household('c@example.org', 'daily');
    await notice(off.primary, 'X');
    await notice(none.primary, 'Y');
    expect((await buildViewerDigests({ db: worker, kek, now: TUESDAY })).queued).toBe(0);
    expect(await outbox()).toHaveLength(0);
  });

  it('never includes notices of a kids profile', async () => {
    const home = await household('a@example.org', 'daily');
    await notice(home.second, 'Grown up title');
    await t.pool.query(
      `INSERT INTO viewer_notices (profile_id, kind, title, href, dedupe_key, created_at)
       VALUES ($1, 'new_video', 'Was adult', '/browse', 'old', now())`,
      [home.second],
    );
    await t.pool.query('UPDATE profiles SET is_kids = true, max_maturity_rank = 0 WHERE id = $1', [home.second]);
    await buildViewerDigests({ db: worker, kek, now: TUESDAY });
    expect(await outbox()).toHaveLength(0);
  });

  it('limits lines by the primary profile maturity limit, whichever profile got the notice', async () => {
    const home = await household('a@example.org', 'daily', 1);
    await notice(home.second, 'Mature title', 3);
    await notice(home.second, 'Gentle title', 1);
    await buildViewerDigests({ db: worker, kek, now: TUESDAY });
    const lines = String((await outbox())[0]?.vars.lines).split('\n');
    expect(lines).toEqual(['Gentle title']);
    const text = JSON.stringify((await outbox())[0]?.vars);
    expect(text).not.toContain(home.primary);
    expect(text).not.toContain(home.second);
  });

  it('weekly sends on Monday only and covers the week', async () => {
    const home = await household('a@example.org', 'weekly');
    await notice(home.primary, 'Early in the week', 0, 60 * 24 * 5);
    expect((await buildViewerDigests({ db: worker, kek, now: TUESDAY })).queued).toBe(0);
    expect((await buildViewerDigests({ db: worker, kek, now: MONDAY })).queued).toBe(1);
    expect((await outbox())[0]).toMatchObject({ kind: 'viewer_digest_weekly' });
  });

  it('ignores notices older than a week, so a returning account is not flooded', async () => {
    const home = await household('a@example.org', 'daily');
    await notice(home.primary, 'Ancient', 0, 60 * 24 * 9);
    expect((await buildViewerDigests({ db: worker, kek, now: TUESDAY })).queued).toBe(0);
  });

  it('forgets the sealed address when the account email changes', async () => {
    const home = await household('a@example.org', 'daily');
    await t.pool.query('UPDATE accounts SET email_enc = $2 WHERE id = $1', [home.accountId, randomBytes(48)]);
    const row = await t.pool.query('SELECT address_enc FROM viewer_notification_prefs WHERE account_id = $1', [home.accountId]);
    expect(row.rows[0].address_enc).toBeNull();
  });

  it('the unsubscribe function turns email off for one account only and clears the address', async () => {
    const a = await household('a@example.org', 'daily');
    const b = await household('b@example.org', 'daily');
    const result = await t.pool.query('SELECT viewer_notices_unsubscribe($1) AS done', [a.accountId]);
    expect(result.rows[0].done).toBe(true);
    const rows = await t.pool.query('SELECT account_id, email_frequency, address_enc FROM viewer_notification_prefs');
    const byId = new Map(rows.rows.map((r) => [r.account_id, r]));
    expect(byId.get(a.accountId)).toMatchObject({ email_frequency: 'off', address_enc: null });
    expect(byId.get(b.accountId)?.email_frequency).toBe('daily');
  });
});
