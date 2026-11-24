import { randomBytes } from 'node:crypto';
import { uuidv7 } from '@ad/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { schema } from './index';
import { asRole, createTestDatabase, integrationEnabled, makeAccount, type TestDatabase } from './testing';

describe.skipIf(!integrationEnabled())('donation_review_resolve (migration 0056)', () => {
  let t: TestDatabase;
  let adminId: string;
  let editorId: string;
  beforeAll(async () => {
    t = await createTestDatabase();
    const [a, e] = [makeAccount({ role: 'admin' }), makeAccount({ role: 'editor' })];
    await t.db.insert(schema.accounts).values([a, e]);
    [adminId, editorId] = [a.id, e.id];
  });
  afterAll(async () => {
    await t?.drop();
  });

  async function seed(status: string) {
    const reference = `ad-don-${randomBytes(10).toString('hex')}`;
    await t.pool.query(
      `INSERT INTO donations (id, reference, currency, amount_minor, paid_amount_minor, donor_email_enc, donor_email_hash, site_mode, status, review_reason)
       VALUES ($1, $2, 'NGN', 500000, 100000, 'e', 'h', 'live', $3::donation_status, 'amount_lower')`,
      [uuidv7(), reference, status],
    );
    return reference;
  }
  const resolve = (reference: string, role: string | undefined, accountId: string | undefined, accept: boolean) =>
    asRole(t.pool, 'ad_app', { actorRole: role, accountId }, async (c) => {
      const id = (await c.query('SELECT id FROM donations WHERE reference = $1', [reference])).rows[0]?.id ?? (await t.pool.query('SELECT id FROM donations WHERE reference = $1', [reference])).rows[0].id;
      return (await c.query('SELECT donation_review_resolve($1::uuid, $2, $3) AS ok', [id, accept, 'checked with the donor'])).rows[0].ok as boolean;
    });
  const row = async (reference: string) => (await t.pool.query('SELECT status, review_reason, paid_at FROM donations WHERE reference = $1', [reference])).rows[0];

  it('lets an admin accept a gift in review: it becomes succeeded with the note kept', async () => {
    const ref = await seed('needs_review');
    expect(await resolve(ref, 'admin', adminId, true)).toBe(true);
    const r = await row(ref);
    expect(r.status).toBe('succeeded');
    expect(r.review_reason).toContain('checked with the donor');
    expect(r.paid_at).not.toBeNull();
  });

  it('lets an admin reject a gift in review: it becomes failed', async () => {
    const ref = await seed('needs_review');
    expect(await resolve(ref, 'admin', adminId, false)).toBe(true);
    expect((await row(ref)).status).toBe('failed');
  });

  it('refuses an editor and a caller with no role, changing nothing', async () => {
    const ref = await seed('needs_review');
    await expect(resolve(ref, 'editor', editorId, true)).rejects.toThrow();
    await expect(resolve(ref, undefined, undefined, true)).rejects.toThrow();
    expect((await row(ref)).status).toBe('needs_review');
  });

  it('does nothing for a gift that is not in review and answers false', async () => {
    const ref = await seed('succeeded');
    expect(await resolve(ref, 'admin', adminId, false)).toBe(false);
    expect((await row(ref)).status).toBe('succeeded');
  });
});
