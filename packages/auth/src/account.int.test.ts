import { schema } from '@ad/db';
import { integrationEnabled } from '@ad/db/testing';
import { RateLimited, uuidv7 } from '@ad/shared';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AccountService } from './accounts';
import { emailHash } from './identifiers';
import { KeyService, KeyUnavailable } from './keys';
import { createAuthHarness, registerMember, signInActor, type AuthHarness } from './testing';
import { FieldErrors, InvalidCredentials } from './types';

describe.skipIf(!integrationEnabled())('account overview, email change and deletion', () => {
  let h: AuthHarness;
  let auth: AccountService;
  let n = 0;
  const newAddress = () => `new${++n}@example.org`;

  beforeAll(async () => {
    h = await createAuthHarness();
    auth = new AccountService(h.deps);
  });
  afterAll(async () => {
    await h.drop();
  });

  describe('overview', () => {
    it('shows the decrypted email, verified state, member since date and profile count', async () => {
      const m = await registerMember(h, auth);
      const { actor } = await signInActor(h, auth, m);
      await h.dbs.admin.db.insert(schema.profiles).values({
        id: uuidv7(),
        accountId: m.id,
        nameEnc: Buffer.from('x'),
        avatarId: 'sun',
        isPrimary: true,
      });
      const overview = await auth.getOverview(actor);
      expect(overview).toMatchObject({
        email: m.email,
        emailVerified: true,
        profileCount: 1,
        role: 'viewer',
      });
      expect(overview.memberSince).toBeInstanceOf(Date);
    });
  });

  describe('password tries left', () => {
    it('counts down with each wrong confirmation', async () => {
      const m = await registerMember(h, auth);
      const { actor } = await signInActor(h, auth, m);
      expect(await auth.triesLeft(actor)).toBe(5);
      await expect(auth.reauthenticate(actor, 'not-my-password-1', h.meta)).rejects.toBeInstanceOf(
        FieldErrors,
      );
      expect(await auth.triesLeft(actor)).toBe(4);
    });
  });

  describe('change email', () => {
    it('mails a code to the new address and a notice to the old one, and changes nothing yet', async () => {
      const m = await registerMember(h, auth);
      const { actor } = await signInActor(h, auth, m);
      const target = newAddress();
      const result = await auth.requestEmailChange(
        actor,
        { newEmail: target, password: m.password },
        h.meta,
      );
      expect(result).toEqual({ pendingEmail: target });
      expect(h.codeFor(target)).toMatch(/^\d{6}$/);
      expect(
        h.transport.outbox.some(
          (mail) => mail.to === m.email && /change the email/i.test(mail.subject),
        ),
      ).toBe(true);
      expect((await auth.signIn({ email: m.email, password: m.password }, h.meta)).status).toBe(
        'signed_in',
      );
    });

    it('applies on the right code, ends other sessions, and the new address signs in', async () => {
      const m = await registerMember(h, auth);
      const { actor, session } = await signInActor(h, auth, m);
      const other = await signInActor(h, auth, m);
      const target = newAddress();
      await auth.requestEmailChange(actor, { newEmail: target, password: m.password }, h.meta);
      await auth.confirmEmailChange(actor, { code: h.codeFor(target) }, h.meta);
      expect(await h.deps.sessions.validate(other.session.token)).toBeNull();
      expect(await h.deps.sessions.validate(session.token)).not.toBeNull();
      expect((await auth.signIn({ email: target, password: m.password }, h.meta)).status).toBe(
        'signed_in',
      );
      await expect(
        auth.signIn({ email: m.email, password: m.password }, h.meta),
      ).rejects.toBeInstanceOf(InvalidCredentials);
      const audit = await h.dbs.admin.db
        .select()
        .from(schema.auditLog)
        .where(eq(schema.auditLog.action, 'auth.email_changed'));
      expect(audit.length).toBeGreaterThan(0);
    });

    it('also applies from the link in the email', async () => {
      const m = await registerMember(h, auth);
      const { actor } = await signInActor(h, auth, m);
      const target = newAddress();
      await auth.requestEmailChange(actor, { newEmail: target, password: m.password }, h.meta);
      expect(await auth.verifyLink(h.tokenFor(target), h.meta)).toEqual({
        status: 'verified',
        purpose: 'change_email',
      });
      expect((await auth.getOverview(actor)).email).toBe(target);
    });

    it('answers a taken address like a free one and warns the other owner', async () => {
      const m = await registerMember(h, auth);
      const taken = await registerMember(h, auth);
      const { actor } = await signInActor(h, auth, m);
      const before = h.mailsTo(taken.email);
      const result = await auth.requestEmailChange(
        actor,
        { newEmail: taken.email, password: m.password },
        h.meta,
      );
      expect(result).toEqual({ pendingEmail: taken.email });
      expect(h.mailsTo(taken.email)).toBe(before + 1);
      expect(h.transport.outbox.at(-1)?.subject).toMatch(/tried to sign up/i);
      await expect(auth.confirmEmailChange(actor, { code: '123456' }, h.meta)).resolves.toEqual({
        status: 'invalid',
      });
    });

    it('needs the right password and counts mistakes toward the lockout', async () => {
      const m = await registerMember(h, auth);
      const { actor } = await signInActor(h, auth, m);
      await expect(
        auth.requestEmailChange(
          actor,
          { newEmail: newAddress(), password: 'wrong-password-12' },
          h.meta,
        ),
      ).rejects.toBeInstanceOf(FieldErrors);
      for (let i = 0; i < 4; i++)
        await auth
          .requestEmailChange(
            actor,
            { newEmail: newAddress(), password: 'wrong-password-12' },
            h.meta,
          )
          .catch(() => undefined);
      await expect(
        auth.requestEmailChange(actor, { newEmail: newAddress(), password: m.password }, h.meta),
      ).rejects.toBeInstanceOf(RateLimited);
    });

    it('keeps the old address when the code is wrong or the request expires', async () => {
      const m = await registerMember(h, auth);
      const { actor } = await signInActor(h, auth, m);
      const target = newAddress();
      await auth.requestEmailChange(actor, { newEmail: target, password: m.password }, h.meta);
      const code = h.codeFor(target);
      expect(
        (
          await auth.confirmEmailChange(
            actor,
            { code: code === '000000' ? '000001' : '000000' },
            h.meta,
          )
        ).status,
      ).toBe('invalid');
      h.advance(24 * 3600 + 1);
      expect((await auth.confirmEmailChange(actor, { code }, h.meta)).status).toBe('expired');
      expect((await auth.getOverview(actor)).email).toBe(m.email);
    });

    it('rejects an invalid address and the current address', async () => {
      const m = await registerMember(h, auth);
      const { actor } = await signInActor(h, auth, m);
      await expect(
        auth.requestEmailChange(actor, { newEmail: 'nope', password: m.password }, h.meta),
      ).rejects.toBeInstanceOf(FieldErrors);
      await expect(
        auth.requestEmailChange(actor, { newEmail: m.email, password: m.password }, h.meta),
      ).rejects.toBeInstanceOf(FieldErrors);
    });
  });

  describe('fix a mistyped address before verifying', () => {
    it('moves an unverified account to the corrected address and mails a new code there', async () => {
      const m = await registerMember(h, auth, { verified: false });
      const target = newAddress();
      const result = await auth.changeUnverifiedEmail(
        { email: m.email, password: m.password, newEmail: target },
        h.meta,
      );
      expect(result).toEqual({ email: target });
      expect(
        (await auth.verifyCode({ email: target, code: h.codeFor(target) }, h.meta)).status,
      ).toBe('verified');
    });

    it('needs the password and refuses a verified account', async () => {
      const m = await registerMember(h, auth, { verified: false });
      await expect(
        auth.changeUnverifiedEmail(
          { email: m.email, password: 'wrong-password-12', newEmail: newAddress() },
          h.meta,
        ),
      ).rejects.toBeInstanceOf(InvalidCredentials);
      const verified = await registerMember(h, auth);
      await expect(
        auth.changeUnverifiedEmail(
          { email: verified.email, password: verified.password, newEmail: newAddress() },
          h.meta,
        ),
      ).rejects.toBeInstanceOf(InvalidCredentials);
    });
  });

  describe('delete account', () => {
    async function withProfiles(m: { id: string }) {
      await h.dbs.admin.db.insert(schema.profiles).values([
        {
          id: uuidv7(),
          accountId: m.id,
          nameEnc: Buffer.from('a'),
          avatarId: 'sun',
          isPrimary: true,
        },
        { id: uuidv7(), accountId: m.id, nameEnc: Buffer.from('b'), avatarId: 'moon', position: 1 },
      ]);
    }

    it('needs the password and the word DELETE', async () => {
      const m = await registerMember(h, auth);
      const { actor } = await signInActor(h, auth, m);
      await expect(
        auth.deleteAccount(actor, { password: m.password, confirmation: 'delete' }, h.meta),
      ).rejects.toMatchObject({ fields: { confirmation: expect.any(String) } });
      await expect(
        auth.deleteAccount(
          actor,
          { password: 'wrong-password-12', confirmation: 'DELETE' },
          h.meta,
        ),
      ).rejects.toBeInstanceOf(FieldErrors);
      expect((await auth.getOverview(actor)).email).toBe(m.email);
    });

    it('purges personal data, ends sessions, shreds the key and sends a notice', async () => {
      const m = await registerMember(h, auth);
      const { actor, session } = await signInActor(h, auth, m);
      await withProfiles(m);
      const sealedEmail = (
        await h.dbs.admin.db.select().from(schema.accounts).where(eq(schema.accounts.id, m.id))
      )[0]!.emailEnc!;
      const before = h.mailsTo(m.email);
      await auth.deleteAccount(actor, { password: m.password, confirmation: 'DELETE' }, h.meta);
      await h.settle();

      const [row] = await h.dbs.admin.db
        .select()
        .from(schema.accounts)
        .where(eq(schema.accounts.id, m.id));
      expect(row).toMatchObject({
        status: 'deleted',
        emailHash: null,
        emailEnc: null,
        passwordHash: null,
        displayNameEnc: null,
      });
      expect(row?.deletedAt).not.toBeNull();
      expect(
        await h.dbs.admin.db
          .select()
          .from(schema.profiles)
          .where(eq(schema.profiles.accountId, m.id)),
      ).toHaveLength(0);
      for (const table of [
        schema.sessions,
        schema.emailTokens,
        schema.consents,
        schema.mfaFactors,
        schema.mfaRecoveryCodes,
      ]) {
        expect(
          await h.dbs.admin.db.select().from(table).where(eq(table.accountId, m.id)),
        ).toHaveLength(0);
      }
      expect(await h.deps.sessions.validate(session.token)).toBeNull();
      const keys = await h.dbs.admin.keysPool.query(
        'SELECT 1 FROM user_keys WHERE account_id = $1',
        [m.id],
      );
      expect(keys.rowCount).toBe(0);
      await expect(h.deps.keys.open(m.id, 'email', sealedEmail)).rejects.toBeInstanceOf(
        KeyUnavailable,
      );
      const [deletion] = await h.dbs.admin.db
        .select()
        .from(schema.accountDeletions)
        .where(eq(schema.accountDeletions.accountId, m.id));
      expect(deletion?.mainDataPurgedAt).not.toBeNull();
      expect(deletion?.dekDestroyedAt).not.toBeNull();
      expect(deletion?.backupsClearAfter?.getTime()).toBe(
        h.deps.clock!().getTime() + 14 * 86400_000,
      );
      await expect(
        auth.signIn({ email: m.email, password: m.password }, h.meta),
      ).rejects.toBeInstanceOf(InvalidCredentials);
      expect(h.mailsTo(m.email)).toBe(before + 1);
      expect(h.transport.outbox.at(-1)?.subject).toMatch(/was deleted/i);
    });

    it('audits the deletion under a hashed identifier, not the account id', async () => {
      const m = await registerMember(h, auth);
      const { actor } = await signInActor(h, auth, m);
      await auth.deleteAccount(actor, { password: m.password, confirmation: 'DELETE' }, h.meta);
      const rows = await h.dbs.admin.db
        .select()
        .from(schema.auditLog)
        .where(eq(schema.auditLog.action, 'account.deleted'));
      const mine = rows.find((r) => r.metadata && JSON.stringify(r).includes('deleted'));
      expect(mine).toBeDefined();
      expect(JSON.stringify(rows)).not.toContain(m.id);
      expect(JSON.stringify(rows)).not.toContain(m.email);
    });

    it('keeps the record retryable when the key cannot be destroyed, and a retry finishes the job', async () => {
      const noShred = new KeyService({ keysDb: h.dbs.keys.db, kek: h.deps.kek });
      const cautious = new AccountService({ ...h.deps, keys: noShred });
      const m = await registerMember(h, cautious);
      const { actor } = await signInActor(h, cautious, m);
      await cautious.deleteAccount(actor, { password: m.password, confirmation: 'DELETE' }, h.meta);
      const [pending] = await h.dbs.admin.db
        .select()
        .from(schema.accountDeletions)
        .where(eq(schema.accountDeletions.accountId, m.id));
      expect(pending?.dekDestroyedAt).toBeNull();
      expect(pending?.mainDataPurgedAt).not.toBeNull();
      expect(await auth.destroyPendingKeys()).toBeGreaterThanOrEqual(1);
      const [done] = await h.dbs.admin.db
        .select()
        .from(schema.accountDeletions)
        .where(eq(schema.accountDeletions.accountId, m.id));
      expect(done?.dekDestroyedAt).not.toBeNull();
      expect(await auth.destroyPendingKeys()).toBe(0);
    });

    it('refuses to delete the last active admin', async () => {
      const m = await registerMember(h, auth);
      // Staff cannot use the viewer form (L-6), so sign in first and promote afterwards.
      const { actor: viewerActor } = await signInActor(h, auth, m);
      await h.dbs.admin.db
        .update(schema.accounts)
        .set({ role: 'admin' })
        .where(eq(schema.accounts.id, m.id));
      const actor = { ...viewerActor, role: 'admin' as const };
      await expect(
        auth.deleteAccount(actor, { password: m.password, confirmation: 'DELETE' }, h.meta),
      ).rejects.toMatchObject({ name: 'Conflict' });
      expect(
        (await h.dbs.admin.db.select().from(schema.accounts).where(eq(schema.accounts.id, m.id)))[0]
          ?.status,
      ).toBe('active');
      expect(Buffer.from(emailHash(m.email, h.deps.pepper)).length).toBe(32);
    });
  });
});
