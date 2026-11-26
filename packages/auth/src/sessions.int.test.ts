import { schema } from '@ad/db';
import { makeAccount } from '@ad/db/testing';
import { integrationEnabled } from '@ad/db/testing';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SessionService, DEFAULT_SESSION_POLICIES } from './sessions';
import { createAuthTestDatabases, type AuthTestDatabases } from './testing';

const START = new Date('2026-03-01T10:00:00Z').getTime();

describe.skipIf(!integrationEnabled())('SessionService', () => {
  let dbs: AuthTestDatabases;
  let now = START;
  const clock = () => new Date(now);
  const at = (seconds: number) => {
    now = START + seconds * 1000;
  };
  let sessions: SessionService;

  async function newAccount(overrides: Parameters<typeof makeAccount>[0] = {}) {
    const account = makeAccount(overrides);
    await dbs.admin.db.insert(schema.accounts).values(account);
    return account;
  }

  beforeAll(async () => {
    dbs = await createAuthTestDatabases();
    sessions = new SessionService(dbs.app.db, { clock });
  });
  afterAll(async () => {
    await dbs.drop();
  });

  it('issues an opaque token and stores only its hash', async () => {
    at(0);
    const account = await newAccount();
    const { token } = await sessions.create({
      accountId: account.id,
      kind: 'viewer',
      ipTrunc: '203.0.113.0/24',
      userAgent: 'Mozilla/5.0',
    });
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const rows = await dbs.admin.db
      .select()
      .from(schema.sessions)
      .where(eq(schema.sessions.accountId, account.id));
    expect(rows).toHaveLength(1);
    expect(Buffer.from(rows[0]!.tokenHash).toString('utf8')).not.toContain(token);
    expect(rows[0]!.tokenHash).toHaveLength(32);
  });

  it('validates a live token and exposes the account role and verification state', async () => {
    at(0);
    const account = await newAccount({ role: 'editor' });
    const { token } = await sessions.create({ accountId: account.id, kind: 'viewer' });
    const context = await sessions.validate(token);
    expect(context).toMatchObject({
      accountId: account.id,
      role: 'editor',
      emailVerified: true,
      mfaVerified: false,
    });
  });

  it('returns null for unknown, empty and malformed tokens', async () => {
    expect(await sessions.validate('nope')).toBeNull();
    expect(await sessions.validate('')).toBeNull();
    expect(await sessions.validate('x'.repeat(500))).toBeNull();
  });

  it('gives viewers 30 days idle and 90 days absolute', async () => {
    at(0);
    const account = await newAccount();
    const { token } = await sessions.create({ accountId: account.id, kind: 'viewer' });
    expect(DEFAULT_SESSION_POLICIES.viewer).toEqual({
      idleSeconds: 30 * 86400,
      absoluteSeconds: 90 * 86400,
    });
    at(29 * 86400);
    expect(await sessions.validate(token)).not.toBeNull();
    at(29 * 86400 + 30 * 86400 + 1);
    expect(await sessions.validate(token)).toBeNull();
  });

  it('slides the idle window on use but never past the absolute limit', async () => {
    at(0);
    const account = await newAccount();
    const { token } = await sessions.create({ accountId: account.id, kind: 'viewer' });
    for (let day = 20; day <= 80; day += 20) {
      at(day * 86400);
      expect(await sessions.validate(token), `day ${day}`).not.toBeNull();
    }
    at(91 * 86400);
    expect(await sessions.validate(token)).toBeNull();
  });

  it('does not write on every request, only after the touch interval', async () => {
    at(0);
    const account = await newAccount();
    const { token } = await sessions.create({ accountId: account.id, kind: 'viewer' });
    at(10);
    await sessions.validate(token);
    let [row] = await dbs.admin.db
      .select()
      .from(schema.sessions)
      .where(eq(schema.sessions.accountId, account.id));
    expect(row!.lastSeenAt.getTime()).toBe(START);
    at(61);
    await sessions.validate(token);
    [row] = await dbs.admin.db
      .select()
      .from(schema.sessions)
      .where(eq(schema.sessions.accountId, account.id));
    expect(row!.lastSeenAt.getTime()).toBe(START + 61_000);
  });

  it('ends a revoked session at once', async () => {
    at(0);
    const account = await newAccount();
    const { token, session } = await sessions.create({ accountId: account.id, kind: 'viewer' });
    await sessions.revoke(session.id);
    expect(await sessions.validate(token)).toBeNull();
  });

  it('revokeAll keeps the named session and ends the rest', async () => {
    at(0);
    const account = await newAccount();
    const keep = await sessions.create({ accountId: account.id, kind: 'viewer' });
    const other = await sessions.create({ accountId: account.id, kind: 'viewer' });
    await sessions.revokeAll(account.id, { exceptSessionId: keep.session.id });
    expect(await sessions.validate(keep.token)).not.toBeNull();
    expect(await sessions.validate(other.token)).toBeNull();
    await sessions.revokeAll(account.id);
    expect(await sessions.validate(keep.token)).toBeNull();
  });

  it('rejects and revokes the session of a suspended account on the next request', async () => {
    at(0);
    const account = await newAccount();
    const { token } = await sessions.create({ accountId: account.id, kind: 'viewer' });
    await dbs.admin.db
      .update(schema.accounts)
      .set({ status: 'suspended' })
      .where(eq(schema.accounts.id, account.id));
    expect(await sessions.validate(token)).toBeNull();
    const [row] = await dbs.admin.db
      .select()
      .from(schema.sessions)
      .where(eq(schema.sessions.accountId, account.id));
    expect(row!.revokedAt).not.toBeNull();
  });

  it('treats a deleted account as signed out', async () => {
    at(0);
    const account = await newAccount();
    const { token } = await sessions.create({ accountId: account.id, kind: 'viewer' });
    await dbs.admin.pool.query(
      "UPDATE accounts SET status = 'deleted', deleted_at = now(), email_hash = NULL, email_enc = NULL, password_hash = NULL WHERE id = $1",
      [account.id],
    );
    expect(await sessions.validate(token)).toBeNull();
  });

  it('shows an unverified account as unverified', async () => {
    at(0);
    const account = await newAccount({ emailVerifiedAt: null });
    const { token } = await sessions.create({ accountId: account.id, kind: 'viewer' });
    expect((await sessions.validate(token))?.emailVerified).toBe(false);
  });

  it('a pending second factor session lives ten minutes and carries no second factor mark', async () => {
    at(0);
    const account = await newAccount({ role: 'admin' });
    const { token } = await sessions.create({ accountId: account.id, kind: 'pending_mfa' });
    at(9 * 60);
    expect((await sessions.validate(token))?.mfaVerified).toBe(false);
    at(9 * 60 + 11 * 60);
    expect(await sessions.validate(token)).toBeNull();
  });

  it('promoting after the second factor rotates the token and applies staff windows', async () => {
    at(0);
    const account = await newAccount({ role: 'admin' });
    const first = await sessions.create({ accountId: account.id, kind: 'pending_mfa' });
    const second = await sessions.promoteToStaff(first.session.id);
    expect(second.token).not.toBe(first.token);
    expect(await sessions.validate(first.token)).toBeNull();
    const context = await sessions.validate(second.token);
    expect(context?.mfaVerified).toBe(true);
    at(6 * 86400);
    expect(await sessions.validate(second.token)).not.toBeNull();
    at(14 * 86400);
    expect(await sessions.validate(second.token)).toBeNull();
  });

  it('caps a staff session at 30 days even with constant activity', async () => {
    at(0);
    const account = await newAccount({ role: 'admin' });
    const pending = await sessions.create({ accountId: account.id, kind: 'pending_mfa' });
    const { token } = await sessions.promoteToStaff(pending.session.id);
    for (let day = 5; day < 30; day += 5) {
      at(day * 86400);
      expect(await sessions.validate(token), `day ${day}`).not.toBeNull();
    }
    at(30 * 86400 + 1);
    expect(await sessions.validate(token)).toBeNull();
  });

  it('records a reauthentication time that callers can check', async () => {
    at(0);
    const account = await newAccount();
    const { token, session } = await sessions.create({ accountId: account.id, kind: 'viewer' });
    expect((await sessions.validate(token))?.reauthAt).toBeNull();
    at(30);
    await sessions.markReauth(session.id);
    expect((await sessions.validate(token))?.reauthAt?.getTime()).toBe(START + 30_000);
  });

  it('lists only the account own active sessions and lets the owner revoke one', async () => {
    at(0);
    const mine = await newAccount();
    const theirs = await newAccount();
    const a = await sessions.create({ accountId: mine.id, kind: 'viewer', userAgent: 'Phone' });
    await sessions.create({ accountId: mine.id, kind: 'viewer', userAgent: 'Laptop' });
    const stranger = await sessions.create({ accountId: theirs.id, kind: 'viewer' });
    const list = await sessions.list(mine.id);
    expect(list.map((s) => s.userAgent).sort()).toEqual(['Laptop', 'Phone']);
    expect(await sessions.revokeOwn(mine.id, stranger.session.id)).toBe(false);
    expect(await sessions.validate(stranger.token)).not.toBeNull();
    expect(await sessions.revokeOwn(mine.id, a.session.id)).toBe(true);
    expect(await sessions.validate(a.token)).toBeNull();
    expect(await sessions.list(mine.id)).toHaveLength(1);
  });

  it('truncates a very long user agent instead of failing', async () => {
    at(0);
    const account = await newAccount();
    const { session } = await sessions.create({
      accountId: account.id,
      kind: 'viewer',
      userAgent: 'x'.repeat(500),
    });
    const [row] = await dbs.admin.db
      .select()
      .from(schema.sessions)
      .where(eq(schema.sessions.id, session.id));
    expect(row!.userAgent).toHaveLength(200);
  });

  describe('kids lock', () => {
    async function withProfiles() {
      const account = await newAccount();
      const mine = await dbs.admin.db
        .insert(schema.profiles)
        .values({ accountId: account.id, nameEnc: Buffer.from('a'), avatarId: 'sun', isKids: true })
        .returning({ id: schema.profiles.id });
      const stranger = await newAccount();
      const theirs = await dbs.admin.db
        .insert(schema.profiles)
        .values({ accountId: stranger.id, nameEnc: Buffer.from('b'), avatarId: 'sun' })
        .returning({ id: schema.profiles.id });
      at(0);
      const { token, session } = await sessions.create({ accountId: account.id, kind: 'viewer' });
      return {
        account,
        token,
        sessionId: session.id,
        profileId: mine[0]!.id,
        foreignId: theirs[0]!.id,
      };
    }

    it('stores the active profile and lock on the session and reads them back', async () => {
      const u = await withProfiles();
      expect((await sessions.validate(u.token))?.kidsLocked).toBe(false);

      await sessions.setProfile(u.sessionId, u.account.id, u.profileId, true);

      const context = await sessions.validate(u.token);
      expect(context).toMatchObject({ activeProfileId: u.profileId, kidsLocked: true });
    });

    it('refuses a profile that belongs to another account', async () => {
      const u = await withProfiles();

      await expect(
        sessions.setProfile(u.sessionId, u.account.id, u.foreignId, false),
      ).rejects.toThrow();
      expect((await sessions.validate(u.token))?.activeProfileId).toBeNull();
    });

    it('keeps the lock for the same session and never leaks it to a new session', async () => {
      const u = await withProfiles();
      await sessions.setProfile(u.sessionId, u.account.id, u.profileId, true);

      const again = await sessions.validate(u.token);
      const fresh = await sessions.create({ accountId: u.account.id, kind: 'viewer' });

      expect(again?.kidsLocked).toBe(true);
      expect((await sessions.validate(fresh.token))?.kidsLocked).toBe(false);
    });

    it('clears the lock and the active profile', async () => {
      const u = await withProfiles();
      await sessions.setProfile(u.sessionId, u.account.id, u.profileId, true);

      await sessions.clearKidsLock(u.sessionId, u.account.id);

      expect(await sessions.validate(u.token)).toMatchObject({
        kidsLocked: false,
        activeProfileId: null,
      });
    });
  });
});
