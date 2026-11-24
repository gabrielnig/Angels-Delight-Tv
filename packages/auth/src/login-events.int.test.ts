import { schema, withAccount } from '@ad/db';
import { integrationEnabled } from '@ad/db/testing';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AccountService } from './accounts';
import { deviceHash, listLoginEvents, purgeLoginEvents } from './login-events';
import { createAuthHarness, registerMember, type AuthHarness } from './testing';
import { ViewerMfaService } from './viewer-mfa';

describe.skipIf(!integrationEnabled())('login events, device hash and the new device email', () => {
  let h: AuthHarness;
  let auth: AccountService;

  beforeAll(async () => {
    h = await createAuthHarness();
    auth = new AccountService(h.deps);
  });
  afterAll(async () => {
    await h.drop();
  });

  const meta = (over: { deviceId?: string | null; country?: string | null } = {}) => ({
    ...h.meta,
    deviceId: 'deviceId' in over ? over.deviceId : 'dev-A',
    country: 'country' in over ? over.country : 'NG',
  });
  const newDeviceMails = (email: string) =>
    h.transport.outbox.filter((m) => m.to === email && /New sign in/.test(m.subject)).length;

  it('records success and failure with country only, never an address', async () => {
    const member = await registerMember(h, auth);
    await auth
      .signIn({ email: member.email, password: 'wrong password here' }, meta())
      .catch(() => 0);
    h.advance(1);
    await auth.signIn({ email: member.email, password: member.password }, meta());
    const events = await listLoginEvents(h.deps.db, member.id, 20);
    expect(events.map((e) => e.outcome)).toEqual(['success', 'failed']);
    expect(events[0]).toMatchObject({ country: 'NG' });
    expect(JSON.stringify(events)).not.toMatch(/203\.0\./);
  });

  it('stores the country and the device hash on the session, not the raw device id', async () => {
    const member = await registerMember(h, auth);
    const result = await auth.signIn({ email: member.email, password: member.password }, meta());
    if (result.status !== 'signed_in') throw new Error('expected a session');
    const [row] = await h.dbs.admin.db
      .select()
      .from(schema.sessions)
      .where(eq(schema.sessions.id, result.session.id));
    expect(row?.country).toBe('NG');
    expect(
      Buffer.from(row!.deviceHash!).equals(Buffer.from(deviceHash(h.deps.pepper, 'dev-A'))),
    ).toBe(true);
  });

  it('first ever sign in sends nothing, the same device sends nothing, a new device sends one mail per hour', async () => {
    const member = await registerMember(h, auth);
    await auth.signIn({ email: member.email, password: member.password }, meta());
    await h.settle();
    expect(newDeviceMails(member.email)).toBe(0);
    await auth.signIn({ email: member.email, password: member.password }, meta());
    await h.settle();
    expect(newDeviceMails(member.email)).toBe(0);
    await auth.signIn(
      { email: member.email, password: member.password },
      meta({ deviceId: 'dev-B' }),
    );
    await h.settle();
    expect(newDeviceMails(member.email)).toBe(1);
    const mail = h.transport.outbox
      .filter((m) => m.to === member.email && /New sign in/.test(m.subject))
      .at(-1)!;
    expect(mail.text).toContain('Nigeria');
    await auth.signIn(
      { email: member.email, password: member.password },
      meta({ deviceId: 'dev-C' }),
    );
    await h.settle();
    expect(newDeviceMails(member.email)).toBe(1);
    h.advance(3601);
    await auth.signIn(
      { email: member.email, password: member.password },
      meta({ deviceId: 'dev-D' }),
    );
    await h.settle();
    expect(newDeviceMails(member.email)).toBe(2);
  });

  it('flags the event as a new device only once', async () => {
    const member = await registerMember(h, auth);
    await auth.signIn({ email: member.email, password: member.password }, meta());
    h.advance(1);
    await auth.signIn({ email: member.email, password: member.password }, meta());
    const events = await listLoginEvents(h.deps.db, member.id, 20);
    expect(events.map((e) => e.newDevice)).toEqual([false, true]);
  });

  it('an email failure never blocks sign in', async () => {
    const member = await registerMember(h, auth);
    await auth.signIn({ email: member.email, password: member.password }, meta());
    h.transport.failNext(new Error('smtp down'));
    const result = await auth.signIn(
      { email: member.email, password: member.password },
      meta({ deviceId: 'dev-X' }),
    );
    expect(result.status).toBe('signed_in');
  });

  it('records a wrong second step as mfa_failed', async () => {
    const mfa = new ViewerMfaService(h.deps);
    const member = await registerMember(h, mfa);
    const first = await mfa.signIn({ email: member.email, password: member.password }, meta());
    if (first.status !== 'signed_in') throw new Error('x');
    const actor = { accountId: member.id, role: 'viewer' as const, sessionId: first.session.id };
    const begin = await mfa.beginEnrolment(actor, meta());
    const { base32Decode, totpAt } = await import('./totp');
    h.advance(31);
    await mfa.confirmEnrolment(
      actor,
      { code: totpAt(base32Decode(begin.secret), h.deps.clock!().getTime()) },
      meta(),
    );
    const second = await mfa.signIn({ email: member.email, password: member.password }, meta());
    if (second.status !== 'mfa_required') throw new Error('x');
    await mfa.completeSignIn(second.pendingToken, { code: '000000' }, meta()).catch(() => 0);
    const events = await listLoginEvents(h.deps.db, member.id, 20);
    expect(events[0]?.outcome).toBe('mfa_failed');
  });

  it('retention purges old rows and keeps recent ones', async () => {
    const member = await registerMember(h, auth);
    await auth.signIn({ email: member.email, password: member.password }, meta());
    await h.dbs.admin.db.insert(schema.loginEvents).values({
      accountId: member.id,
      outcome: 'success',
      at: new Date(h.deps.clock!().getTime() - 91 * 86_400_000),
    });
    const removed = await purgeLoginEvents(h.dbs.admin.db, h.deps.clock!(), 90);
    expect(removed).toBeGreaterThanOrEqual(1);
    const left = await listLoginEvents(h.deps.db, member.id, 50);
    expect(left).toHaveLength(1);
  });

  it('row level security keeps each account to its own events', async () => {
    const a = await registerMember(h, auth);
    const b = await registerMember(h, auth);
    await auth.signIn({ email: a.email, password: a.password }, meta());
    const seen = await withAccount(h.deps.db, { accountId: b.id, role: 'viewer' }, (tx) =>
      tx.select().from(schema.loginEvents),
    );
    expect(seen.every((row) => row.accountId === b.id)).toBe(true);
  });
});
