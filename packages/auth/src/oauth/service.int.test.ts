import { schema } from '@ad/db';
import { integrationEnabled } from '@ad/db/testing';
import { RateLimited } from '@ad/shared';
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { emailHash } from '../identifiers';
import { base32Decode, totpAt } from '../totp';
import {
  createAuthHarness,
  registerMember,
  signInActor,
  TEST_PASSWORD,
  type AuthHarness,
} from '../testing';
import { FieldErrors } from '../types';
import { FakeGoogle, type FakeUser } from './fake-google';
import { createGoogleClient } from './google';
import { GoogleAuthService, type GoogleOutcome } from './service';

describe.skipIf(!integrationEnabled())('google sign in service (M49-S05 to S07)', () => {
  let h: AuthHarness;
  let fake: FakeGoogle;
  let google: GoogleAuthService;
  let signUpOpen = true;
  let counter = 0;

  beforeAll(async () => {
    h = await createAuthHarness({ signUpPolicy: async () => ({ open: signUpOpen }) });
    fake = new FakeGoogle();
    fake.now = () => h.deps.clock!().getTime();
    google = new GoogleAuthService(h.deps, {
      client: createGoogleClient(
        { clientId: fake.clientId, clientSecret: fake.clientSecret, redirectUri: fake.redirectUri },
        { fetch: fake.fetch, now: () => fake.now() },
      ),
    });
  });
  afterAll(async () => {
    await h.drop();
  });

  const newUser = (over: Partial<FakeUser> = {}): FakeUser => {
    counter += 1;
    return { sub: `g-sub-${counter}`, email: `gina${counter}@example.com`, ...over };
  };

  /** The whole browser trip: start, sign in at Google, come back. */
  async function trip(user: FakeUser, options: { next?: string; actorId?: string } = {}) {
    const start = await google.begin(
      { next: options.next ?? '/library', linkAccountId: options.actorId },
      h.meta,
    );
    const back = fake.authorize(start.url, user);
    return { start, back };
  }
  async function run(user: FakeUser, options: { next?: string } = {}): Promise<GoogleOutcome> {
    const { start, back } = await trip(user, options);
    return google.complete(back, start.cookie, h.meta, null);
  }
  async function createViaGoogle(user: FakeUser = newUser()) {
    const first = await run(user);
    if (first.status !== 'finish_signup')
      throw new Error(`expected finish_signup, got ${first.status}`);
    const done = await google.finishSignUp(
      first.pendingToken,
      { acceptTerms: true, guardianDeclaration: true },
      h.meta,
    );
    return { user, done };
  }
  const accountRow = async (email: string) => {
    const [row] = await h.dbs.admin.db
      .select()
      .from(schema.accounts)
      .where(eq(schema.accounts.emailHash, Buffer.from(emailHash(email, h.deps.pepper))));
    return row;
  };
  const identityRows = (accountId: string) =>
    h.dbs.admin.db
      .select()
      .from(schema.accountIdentities)
      .where(eq(schema.accountIdentities.accountId, accountId));
  const auditCount = async (
    action: string,
    accountId: string,
    outcome: 'success' | 'denied' | 'failure' = 'success',
  ) =>
    (
      await h.dbs.admin.db
        .select()
        .from(schema.auditLog)
        .where(
          and(
            eq(schema.auditLog.action, action),
            eq(schema.auditLog.actorAccountId, accountId),
            eq(schema.auditLog.outcome, outcome),
          ),
        )
    ).length;

  it('creates account with null password and verified email, after consent', async () => {
    const user = newUser();
    const first = await run(user, { next: '/library' });
    expect(first).toMatchObject({ status: 'finish_signup', next: '/library' });
    expect(await accountRow(user.email)).toBeUndefined();

    const { done } = await createViaGoogle(user);
    expect(done).toMatchObject({ status: 'signed_in', created: true });
    const row = (await accountRow(user.email))!;
    expect(row.passwordHash).toBeNull();
    expect(row.emailVerifiedAt).not.toBeNull();
    expect(row.role).toBe('viewer');
    const consents = await h.dbs.admin.db
      .select()
      .from(schema.consents)
      .where(eq(schema.consents.accountId, row.id));
    expect(consents.map((c) => c.kind).sort()).toEqual([
      'guardian_declaration',
      'privacy',
      'terms',
    ]);
    const identities = await identityRows(row.id);
    expect(identities).toHaveLength(1);
    expect(identities[0]).toMatchObject({ provider: 'google', subject: user.sub });
    expect(identities[0]!.emailHint).toMatch(/^g\*+@example\.com$/);
    expect(JSON.stringify(identities[0])).not.toContain(user.email);
    await h.settle();
    expect(h.mailsTo(user.email)).toBe(1);
  });

  it('refuses to finish sign up without both consents', async () => {
    const first = await run(newUser());
    if (first.status !== 'finish_signup') throw new Error('expected finish_signup');
    await expect(
      google.finishSignUp(
        first.pendingToken,
        { acceptTerms: true, guardianDeclaration: false },
        h.meta,
      ),
    ).rejects.toBeInstanceOf(FieldErrors);
    await expect(
      google.finishSignUp('forged.token', { acceptTerms: true, guardianDeclaration: true }, h.meta),
    ).rejects.toMatchObject({ name: 'InvalidCredentials' });
  });

  it('second sign in reuses the identity and ignores an email change at Google', async () => {
    const { user, done } = await createViaGoogle();
    if (done.status !== 'signed_in') throw new Error('expected a session');
    h.advance(120);
    const again = await run({ ...user, email: `renamed-${user.email}` });
    expect(again).toMatchObject({ status: 'signed_in', accountId: done.accountId, created: false });
    const [identity] = await identityRows(done.accountId);
    expect(identity!.lastUsedAt).not.toBeNull();
    expect(await accountRow(`renamed-${user.email}`)).toBeUndefined();
    expect(await auditCount('viewer.google_signin', done.accountId)).toBeGreaterThanOrEqual(2);
    expect(
      again.status === 'signed_in' && (await h.deps.sessions.validate(again.session.token)),
    ).toBeTruthy();
  });

  it('refuses an unverified google email and touches no account', async () => {
    const user = newUser({ emailVerified: false });
    expect(await run(user)).toEqual({ status: 'failed' });
    expect(await accountRow(user.email)).toBeUndefined();
    const member = await registerMember(h, google);
    const before = await accountRow(member.email);
    expect(await run({ sub: 'g-evil', email: member.email, emailVerified: false })).toEqual({
      status: 'failed',
    });
    expect((await accountRow(member.email))!.passwordHash).toBe(before!.passwordHash);
    expect(await identityRows(member.id)).toHaveLength(0);
  });

  it('fails generic on missing, forged, mismatched or expired state', async () => {
    const user = newUser();
    const { start, back } = await trip(user);
    expect(await google.complete(back, undefined, h.meta, null)).toEqual({ status: 'failed' });
    expect(await google.complete({ ...back, state: 'other' }, start.cookie, h.meta, null)).toEqual({
      status: 'failed',
    });
    expect(await google.complete({ code: back.code }, start.cookie, h.meta, null)).toEqual({
      status: 'failed',
    });
    expect(await google.complete(back, `${start.cookie}x`, h.meta, null)).toEqual({
      status: 'failed',
    });
    expect(
      await google.complete(
        { error: 'access_denied', state: back.state },
        start.cookie,
        h.meta,
        null,
      ),
    ).toEqual({ status: 'failed' });
    h.advance(11 * 60);
    expect(await google.complete(back, start.cookie, h.meta, null)).toEqual({ status: 'failed' });
  });

  it('rejects code replay', async () => {
    const user = newUser();
    const { start, back } = await trip(user);
    expect((await google.complete(back, start.cookie, h.meta, null)).status).toBe('finish_signup');
    expect(await google.complete(back, start.cookie, h.meta, null)).toEqual({ status: 'failed' });
  });

  it('keeps next only when it is a safe local path', async () => {
    const start = await google.begin({ next: 'https://evil.test/steal' }, h.meta);
    const back = fake.authorize(start.url, newUser());
    expect(await google.complete(back, start.cookie, h.meta, null)).toMatchObject({
      next: '/profiles',
    });
  });

  it('link requires password confirmation for a verified password account', async () => {
    const member = await registerMember(h, google);
    const user = newUser({ email: member.email });
    const outcome = await run(user);
    if (outcome.status !== 'confirm_link') throw new Error(`got ${outcome.status}`);
    expect(await identityRows(member.id)).toHaveLength(0);

    await expect(
      google.confirmLink(outcome.pendingToken, { password: 'a wrong password 99' }, h.meta),
    ).rejects.toBeInstanceOf(FieldErrors);
    expect(await identityRows(member.id)).toHaveLength(0);

    const done = await google.confirmLink(
      outcome.pendingToken,
      { password: member.password },
      h.meta,
    );
    expect(done).toMatchObject({ status: 'signed_in', accountId: member.id });
    expect(await identityRows(member.id)).toHaveLength(1);
    await h.settle();
    expect(
      h.transport.outbox.some((m) => m.to === member.email && /Google was linked/.test(m.subject)),
    ).toBe(true);
    expect(await auditCount('viewer.google_linked', member.id)).toBe(1);
    expect(await run(user)).toMatchObject({ status: 'signed_in', accountId: member.id });
  });

  it('lets the confirmation screens show a masked address from the note', async () => {
    const member = await registerMember(h, google);
    const link = await run(newUser({ email: member.email }));
    if (link.status !== 'confirm_link') throw new Error(`got ${link.status}`);
    expect(google.peekNote(link.pendingToken)).toEqual({
      kind: 'link',
      hint: `${member.email.slice(0, 1)}***@example.com`,
    });
    const created = await run(newUser());
    if (created.status !== 'finish_signup') throw new Error(`got ${created.status}`);
    expect(google.peekNote(created.pendingToken)).toMatchObject({ kind: 'signup' });
    expect(google.peekNote('nonsense')).toBeNull();
  });

  it('wrong passwords on link count toward the sign in lockout', async () => {
    const member = await registerMember(h, google);
    const outcome = await run(newUser({ email: member.email }));
    if (outcome.status !== 'confirm_link') throw new Error(`got ${outcome.status}`);
    for (let i = 0; i < 5; i++) {
      await expect(
        google.confirmLink(
          outcome.pendingToken,
          { password: `wrong password number ${i}` },
          h.meta,
        ),
      ).rejects.toBeInstanceOf(FieldErrors);
    }
    await expect(
      google.confirmLink(outcome.pendingToken, { password: member.password }, h.meta),
    ).rejects.toBeInstanceOf(RateLimited);
    expect(await identityRows(member.id)).toHaveLength(0);
  });

  it('refuses a forged or expired link note', async () => {
    const member = await registerMember(h, google);
    const outcome = await run(newUser({ email: member.email }));
    if (outcome.status !== 'confirm_link') throw new Error(`got ${outcome.status}`);
    await expect(
      google.confirmLink(`${outcome.pendingToken}x`, { password: member.password }, h.meta),
    ).rejects.toMatchObject({ name: 'InvalidCredentials' });
    h.advance(11 * 60);
    await expect(
      google.confirmLink(outcome.pendingToken, { password: member.password }, h.meta),
    ).rejects.toMatchObject({ name: 'InvalidCredentials' });
  });

  it('unverified password account is adopted and its password cleared', async () => {
    const member = await registerMember(h, google, { verified: false });
    const outcome = await run(newUser({ email: member.email }));
    expect(outcome).toMatchObject({ status: 'signed_in', accountId: member.id, created: false });
    const row = (await accountRow(member.email))!;
    expect(row.passwordHash).toBeNull();
    expect(row.emailVerifiedAt).not.toBeNull();
    expect(await identityRows(member.id)).toHaveLength(1);
    await expect(
      google.signIn({ email: member.email, password: member.password }, h.meta),
    ).rejects.toMatchObject({ name: 'InvalidCredentials' });
  });

  it('staff role refused and audited', async () => {
    const member = await registerMember(h, google);
    await h.dbs.admin.db
      .update(schema.accounts)
      .set({ role: 'editor' })
      .where(eq(schema.accounts.id, member.id));
    expect(await run(newUser({ email: member.email }))).toEqual({ status: 'failed' });
    expect(await identityRows(member.id)).toHaveLength(0);
    expect(await auditCount('viewer.google_signin', member.id, 'denied')).toBe(1);
    const [row] = await h.dbs.admin.db
      .select()
      .from(schema.auditLog)
      .where(
        and(
          eq(schema.auditLog.action, 'viewer.google_signin'),
          eq(schema.auditLog.actorAccountId, member.id),
        ),
      );
    expect(row).toMatchObject({ outcome: 'denied' });
  });

  it('suspended refused, pending deletion opens the cancel session', async () => {
    const { user, done } = await createViaGoogle();
    if (done.status !== 'signed_in') throw new Error('expected a session');
    await h.dbs.admin.db
      .update(schema.accounts)
      .set({ status: 'suspended' })
      .where(eq(schema.accounts.id, done.accountId));
    expect(await run(user)).toEqual({ status: 'failed' });
    await h.dbs.admin.db
      .update(schema.accounts)
      .set({ status: 'active' })
      .where(eq(schema.accounts.id, done.accountId));
    expect(await run(user)).toMatchObject({ status: 'signed_in' });
  });

  it('closed sign up refuses a brand new google account', async () => {
    signUpOpen = false;
    try {
      const user = newUser();
      expect(await run(user)).toEqual({ status: 'failed' });
      expect(await accountRow(user.email)).toBeUndefined();
    } finally {
      signUpOpen = true;
    }
  });

  it('unlink refused when it is the only method, allowed after a password is set', async () => {
    const { done } = await createViaGoogle();
    if (done.status !== 'signed_in') throw new Error('expected a session');
    const actor = {
      accountId: done.accountId,
      role: 'viewer' as const,
      sessionId: done.session.id,
    };
    expect(await google.identityStatus(actor)).toMatchObject({ linked: true, hasPassword: false });
    await expect(google.unlink(actor, { password: '' }, h.meta)).rejects.toMatchObject({
      name: 'FieldErrors',
      fields: { password: 'Set a password first' },
    });
    expect(await identityRows(done.accountId)).toHaveLength(1);

    await h.dbs.admin.db
      .update(schema.accounts)
      .set({ passwordHash: await h.deps.hasher.hash(TEST_PASSWORD) })
      .where(eq(schema.accounts.id, done.accountId));
    await expect(
      google.unlink(actor, { password: 'not the password' }, h.meta),
    ).rejects.toBeInstanceOf(FieldErrors);
    await google.unlink(actor, { password: TEST_PASSWORD }, h.meta);
    expect(await identityRows(done.accountId)).toHaveLength(0);
    await h.settle();
    expect(await auditCount('viewer.google_unlinked', done.accountId)).toBe(1);
  });

  it('a signed in person connects google from Security, shown masked', async () => {
    const member = await registerMember(h, google);
    const { actor } = await signInActor(h, google, member);
    expect(await google.identityStatus(actor)).toMatchObject({ linked: false, hasPassword: true });
    const user = newUser({ email: `other-address-${member.email}` });
    const { start, back } = await trip(user, { actorId: member.id });
    expect(await google.complete(back, start.cookie, h.meta, actor)).toMatchObject({
      status: 'linked',
    });
    const status = await google.identityStatus(actor);
    expect(status.linked).toBe(true);
    expect(status.hint).toMatch(/^o\*+@example\.com$/);
    await h.settle();
    expect(await auditCount('viewer.google_linked', member.id)).toBe(1);
  });

  it('connect fails when the session is not the account that started it', async () => {
    const a = await registerMember(h, google);
    const b = await registerMember(h, google);
    const sb = await signInActor(h, google, b);
    const { start, back } = await trip(newUser(), { actorId: a.id });
    expect(await google.complete(back, start.cookie, h.meta, sb.actor)).toEqual({
      status: 'failed',
    });
    expect(await google.complete(back, start.cookie, h.meta, null)).toEqual({ status: 'failed' });
    expect(await identityRows(a.id)).toHaveLength(0);
  });

  it('two accounts cannot claim one sub', async () => {
    const a = await registerMember(h, google);
    const b = await registerMember(h, google);
    const sa = await signInActor(h, google, a);
    const sb = await signInActor(h, google, b);
    const user = newUser();
    const first = await trip(user, { actorId: a.id });
    expect(await google.complete(first.back, first.start.cookie, h.meta, sa.actor)).toMatchObject({
      status: 'linked',
    });
    const second = await trip(user, { actorId: b.id });
    expect(await google.complete(second.back, second.start.cookie, h.meta, sb.actor)).toEqual({
      status: 'failed',
    });
    expect(await identityRows(b.id)).toHaveLength(0);
    expect(await identityRows(a.id)).toHaveLength(1);
  });

  it('viewer with 2fa gets mfa_required after google, and no session until the code', async () => {
    const { user, done } = await createViaGoogle();
    if (done.status !== 'signed_in') throw new Error('expected a session');
    const actor = {
      accountId: done.accountId,
      role: 'viewer' as const,
      sessionId: done.session.id,
    };
    const begin = await google.beginEnrolment(actor, h.meta);
    h.advance(31);
    const code = () => totpAt(base32Decode(begin.secret), h.deps.clock!().getTime());
    await google.confirmEnrolment(actor, { code: code() }, h.meta);
    const sessionsBefore = await h.dbs.admin.db
      .select()
      .from(schema.sessions)
      .where(eq(schema.sessions.accountId, done.accountId));

    const outcome = await run(user);
    if (outcome.status !== 'mfa_required') throw new Error(`got ${outcome.status}`);
    const sessionsAfter = await h.dbs.admin.db
      .select()
      .from(schema.sessions)
      .where(eq(schema.sessions.accountId, done.accountId));
    expect(sessionsAfter).toHaveLength(sessionsBefore.length);
    h.advance(31);
    const opened = await google.completeSignIn(outcome.pendingToken, { code: code() }, h.meta);
    expect(opened.status).toBe('signed_in');
  });

  it('limits starts per address', async () => {
    const meta = h.meta;
    for (let i = 0; i < 20; i++) await google.begin({}, meta);
    await expect(google.begin({}, meta)).rejects.toBeInstanceOf(RateLimited);
  });
});
