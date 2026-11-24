import { schema } from '@ad/db';
import { integrationEnabled } from '@ad/db/testing';
import { Forbidden, RateLimited } from '@ad/shared';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readPendingMfa } from './mfa-pending';
import { base32Decode, totpAt } from './totp';
import {
  createAuthHarness,
  registerMember,
  signInActor,
  type AuthHarness,
  type TestMember,
} from './testing';
import { StaffService } from './staff';
import { FieldErrors, InvalidCredentials } from './types';
import { ViewerMfaService } from './viewer-mfa';

describe.skipIf(!integrationEnabled())('viewer two step verification', () => {
  let h: AuthHarness;
  let mfa: ViewerMfaService;

  beforeAll(async () => {
    h = await createAuthHarness();
    mfa = new ViewerMfaService(h.deps);
  });
  afterAll(async () => {
    await h.drop();
  });

  const codeNow = (secret: string) => totpAt(base32Decode(secret), h.deps.clock!().getTime());

  async function viewerWithMfa() {
    const member = await registerMember(h, mfa);
    const { actor } = await signInActor(h, mfa, member);
    const begin = await mfa.beginEnrolment(actor, h.meta);
    h.advance(31);
    const done = await mfa.confirmEnrolment(actor, { code: codeNow(begin.secret) }, h.meta);
    return { member, actor, secret: begin.secret, recoveryCodes: done.recoveryCodes };
  }

  async function pendingFor(member: TestMember) {
    const result = await mfa.signIn({ email: member.email, password: member.password }, h.meta);
    if (result.status !== 'mfa_required')
      throw new Error(`expected mfa_required, got ${result.status}`);
    return result.pendingToken;
  }

  it('enrols and confirms with a valid code, then shows ten recovery codes once', async () => {
    const { member, recoveryCodes } = await viewerWithMfa();
    expect(recoveryCodes).toHaveLength(10);
    const { actor } = await signInActor(h, mfa, member).catch(() => ({ actor: null }));
    expect(actor).toBeNull(); // sign in now needs the code
    await h.settle();
    expect(h.mailsTo(member.email)).toBeGreaterThan(1);
    expect(
      h.transport.outbox.some(
        (m) => m.to === member.email && /Two step verification is on/.test(m.subject),
      ),
    ).toBe(true);
  });

  it('stores the secret encrypted, not in clear', async () => {
    const member = await registerMember(h, mfa);
    const { actor } = await signInActor(h, mfa, member);
    const begin = await mfa.beginEnrolment(actor, h.meta);
    const [row] = await h.dbs.admin.db
      .select()
      .from(schema.mfaFactors)
      .where(eq(schema.mfaFactors.accountId, member.id));
    expect(Buffer.from(row!.secretEnc).toString('latin1')).not.toContain(begin.secret);
  });

  it('refuses an unconfirmed factor at sign in', async () => {
    const member = await registerMember(h, mfa);
    const { actor } = await signInActor(h, mfa, member);
    await mfa.beginEnrolment(actor, h.meta);
    const result = await mfa.signIn({ email: member.email, password: member.password }, h.meta);
    expect(result.status).toBe('signed_in');
  });

  it('starting again replaces the unconfirmed secret', async () => {
    const member = await registerMember(h, mfa);
    const { actor } = await signInActor(h, mfa, member);
    const first = await mfa.beginEnrolment(actor, h.meta);
    const second = await mfa.beginEnrolment(actor, h.meta);
    expect(second.secret).not.toBe(first.secret);
    h.advance(31);
    await expect(
      mfa.confirmEnrolment(actor, { code: codeNow(first.secret) }, h.meta),
    ).rejects.toBeInstanceOf(FieldErrors);
  });

  it('rejects a wrong code at enrolment and leaves two step off', async () => {
    const member = await registerMember(h, mfa);
    const { actor } = await signInActor(h, mfa, member);
    await mfa.beginEnrolment(actor, h.meta);
    await expect(mfa.confirmEnrolment(actor, { code: '000000' }, h.meta)).rejects.toBeInstanceOf(
      FieldErrors,
    );
    expect((await mfa.status(actor)).enabled).toBe(false);
  });

  it('signIn returns mfa_required and no session when a confirmed factor exists', async () => {
    const { member } = await viewerWithMfa();
    const before = await h.dbs.admin.db
      .select()
      .from(schema.sessions)
      .where(eq(schema.sessions.accountId, member.id));
    const token = await pendingFor(member);
    const after = await h.dbs.admin.db
      .select()
      .from(schema.sessions)
      .where(eq(schema.sessions.accountId, member.id));
    expect(after.length).toBe(before.length);
    expect(readPendingMfa(h.deps.pepper, token, h.deps.clock!().getTime())?.accountId).toBe(
      member.id,
    );
  });

  it('signIn without a factor is unchanged', async () => {
    const member = await registerMember(h, mfa);
    const result = await mfa.signIn({ email: member.email, password: member.password }, h.meta);
    expect(result.status).toBe('signed_in');
  });

  it('can be switched off by config', async () => {
    const { member } = await viewerWithMfa();
    const off = new ViewerMfaService({ ...h.deps, config: { viewerMfaEnabled: false } });
    const result = await off.signIn({ email: member.email, password: member.password }, h.meta);
    expect(result.status).toBe('signed_in');
  });

  it('completes sign in with a code, then refuses the same code again', async () => {
    const { member, secret } = await viewerWithMfa();
    const token = await pendingFor(member);
    h.advance(31);
    const code = codeNow(secret);
    const done = await mfa.completeSignIn(token, { code }, h.meta);
    expect(done.status).toBe('signed_in');
    const context = await h.deps.sessions.validate(done.session.token);
    expect(context?.accountId).toBe(member.id);
    await expect(mfa.completeSignIn(token, { code }, h.meta)).rejects.toBeInstanceOf(FieldErrors);
  });

  it('refuses an expired pending token', async () => {
    const { member, secret } = await viewerWithMfa();
    const token = await pendingFor(member);
    h.advance(601);
    await expect(
      mfa.completeSignIn(token, { code: codeNow(secret) }, h.meta),
    ).rejects.toBeInstanceOf(InvalidCredentials);
  });

  it('wrong code counts toward the mfa lockout', async () => {
    const { member } = await viewerWithMfa();
    const token = await pendingFor(member);
    for (let i = 0; i < 5; i++)
      await mfa.completeSignIn(token, { code: '000000' }, h.meta).catch(() => 0);
    await expect(mfa.completeSignIn(token, { code: '000000' }, h.meta)).rejects.toBeInstanceOf(
      RateLimited,
    );
  });

  it('recovery code works once then is spent, mails the owner and warns at two left', async () => {
    const { member, recoveryCodes } = await viewerWithMfa();
    const token = await pendingFor(member);
    const done = await mfa.completeRecovery(token, { code: recoveryCodes[0]! }, h.meta);
    expect(done.remaining).toBe(9);
    await expect(
      mfa.completeRecovery(token, { code: recoveryCodes[0]! }, h.meta),
    ).rejects.toBeInstanceOf(FieldErrors);
    // codes accept any case and with or without the dash
    const loose = recoveryCodes[1]!.toUpperCase().replace('-', ' ');
    await mfa.completeRecovery(token, { code: loose }, h.meta);
    for (const code of recoveryCodes.slice(2, 8))
      await mfa.completeRecovery(token, { code }, h.meta);
    await h.settle();
    const mails = h.transport.outbox.filter((m) => m.to === member.email);
    expect(mails.filter((m) => /backup code was used/.test(m.subject)).length).toBe(8);
    expect(mails.filter((m) => /running low/.test(m.subject)).length).toBe(1);
  });

  it('regenerate needs the password and invalidates old codes', async () => {
    const { member, actor, recoveryCodes } = await viewerWithMfa();
    await expect(
      mfa.regenerateRecoveryCodes(actor, { password: 'wrong password here' }, h.meta),
    ).rejects.toBeInstanceOf(FieldErrors);
    const fresh = await mfa.regenerateRecoveryCodes(actor, { password: member.password }, h.meta);
    expect(fresh).toHaveLength(10);
    const token = await pendingFor(member);
    await expect(
      mfa.completeRecovery(token, { code: recoveryCodes[0]! }, h.meta),
    ).rejects.toBeInstanceOf(FieldErrors);
    expect((await mfa.completeRecovery(token, { code: fresh[0]! }, h.meta)).remaining).toBe(9);
  });

  it('disable needs the password and a current code, and revokes other sessions', async () => {
    const { member, actor, secret } = await viewerWithMfa();
    const other = await h.deps.sessions.create({ accountId: member.id, kind: 'viewer' });
    h.advance(31);
    await expect(
      mfa.disable(actor, { password: 'wrong password here', code: codeNow(secret) }, h.meta),
    ).rejects.toBeInstanceOf(FieldErrors);
    await expect(
      mfa.disable(actor, { password: member.password, code: '000000' }, h.meta),
    ).rejects.toBeInstanceOf(FieldErrors);
    await mfa.disable(actor, { password: member.password, code: codeNow(secret) }, h.meta);
    expect((await mfa.status(actor)).enabled).toBe(false);
    expect(await h.deps.sessions.validate(other.token)).toBeNull();
    await h.settle();
    expect(
      h.transport.outbox.some((m) => m.to === member.email && /turned off/.test(m.subject)),
    ).toBe(true);
  });

  it('disable accepts a recovery code as the second proof', async () => {
    const { member, actor, recoveryCodes } = await viewerWithMfa();
    await mfa.disable(actor, { password: member.password, code: recoveryCodes[0]! }, h.meta);
    expect((await mfa.status(actor)).enabled).toBe(false);
  });

  it('status reports codes left and flags a low count', async () => {
    const { actor, recoveryCodes, member } = await viewerWithMfa();
    expect(await mfa.status(actor)).toMatchObject({
      enabled: true,
      recoveryRemaining: 10,
      low: false,
    });
    const token = await pendingFor(member);
    for (const code of recoveryCodes.slice(0, 8))
      await mfa.completeRecovery(token, { code }, h.meta);
    expect(await mfa.status(actor)).toMatchObject({ recoveryRemaining: 2, low: true });
  });

  describe('admin reset', () => {
    async function admin() {
      const staff = new StaffService(h.deps);
      const member = await registerMember(h, staff);
      await h.dbs.admin.db
        .update(schema.accounts)
        .set({ role: 'admin' })
        .where(eq(schema.accounts.id, member.id));
      return { accountId: member.id, role: 'admin' as const, sessionId: crypto.randomUUID() };
    }

    it('clears factor and codes, ends sessions, mails the person and writes audit with the reason', async () => {
      const { member, secret } = await viewerWithMfa();
      const reset = await mfa.adminReset(
        await admin(),
        { accountId: member.id, reason: 'Verified by support email on 24 Nov' },
        h.meta,
      );
      expect(reset).toBeUndefined();
      const result = await mfa.signIn({ email: member.email, password: member.password }, h.meta);
      expect(result.status).toBe('signed_in');
      void secret;
      await h.settle();
      expect(
        h.transport.outbox.some((m) => m.to === member.email && /was reset/.test(m.subject)),
      ).toBe(true);
      const audit = await h.dbs.admin.db.select().from(schema.auditLog);
      const row = audit.find((a) => a.action === 'viewer.mfa_reset_by_admin');
      expect(row?.targetId).toBe(member.id);
      expect(JSON.stringify(row?.metadata)).toContain('Verified by support');
    });

    it('needs a reason', async () => {
      const { member } = await viewerWithMfa();
      await expect(
        mfa.adminReset(await admin(), { accountId: member.id, reason: ' ' }, h.meta),
      ).rejects.toBeInstanceOf(FieldErrors);
    });

    it('viewer cannot reset another account', async () => {
      const a = await viewerWithMfa();
      const b = await viewerWithMfa();
      await expect(
        mfa.adminReset(a.actor, { accountId: b.member.id, reason: 'I want in please' }, h.meta),
      ).rejects.toBeInstanceOf(Forbidden);
      expect((await mfa.status(b.actor)).enabled).toBe(true);
    });

    it('an editor cannot reset either (admin only)', async () => {
      const { member } = await viewerWithMfa();
      const staff = new StaffService(h.deps);
      const e = await registerMember(h, staff);
      await h.dbs.admin.db
        .update(schema.accounts)
        .set({ role: 'editor' })
        .where(eq(schema.accounts.id, e.id));
      await expect(
        mfa.adminReset(
          { accountId: e.id, role: 'editor', sessionId: crypto.randomUUID() },
          { accountId: member.id, reason: 'Verified by support' },
          h.meta,
        ),
      ).rejects.toBeInstanceOf(Forbidden);
    });
  });

  it('staff accounts cannot turn on viewer two step', async () => {
    const staff = new StaffService(h.deps);
    const member = await registerMember(h, staff);
    await h.dbs.admin.db
      .update(schema.accounts)
      .set({ role: 'admin' })
      .where(eq(schema.accounts.id, member.id));
    await expect(
      mfa.beginEnrolment(
        { accountId: member.id, role: 'admin', sessionId: crypto.randomUUID() },
        h.meta,
      ),
    ).rejects.toBeInstanceOf(Forbidden);
  });
});
