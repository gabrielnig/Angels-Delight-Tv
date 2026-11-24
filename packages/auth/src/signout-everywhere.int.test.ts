import { integrationEnabled } from '@ad/db/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AccountService } from './accounts';
import { createAuthHarness, registerMember, signInActor, type AuthHarness } from './testing';

describe.skipIf(!integrationEnabled())('sign out everywhere (M49-S12)', () => {
  let h: AuthHarness;
  let auth: AccountService;

  beforeAll(async () => {
    h = await createAuthHarness();
    auth = new AccountService(h.deps);
  });
  afterAll(async () => {
    await h.drop();
  });

  it('ends every session including this one when the password is right', async () => {
    const member = await registerMember(h, auth);
    const first = await signInActor(h, auth, member);
    const second = await signInActor(h, auth, member);
    await auth.signOutEverywhere(first.actor, member.password, h.meta);
    expect(await h.deps.sessions.validate(first.session.token)).toBeNull();
    expect(await h.deps.sessions.validate(second.session.token)).toBeNull();
  });

  it('keeps every session when the password is wrong', async () => {
    const member = await registerMember(h, auth);
    const first = await signInActor(h, auth, member);
    await expect(
      auth.signOutEverywhere(first.actor, 'not the password at all', h.meta),
    ).rejects.toMatchObject({ name: 'FieldErrors' });
    expect(await h.deps.sessions.validate(first.session.token)).not.toBeNull();
  });

  it('lists the country recorded on each session', async () => {
    const member = await registerMember(h, auth);
    await auth.signIn(
      { email: member.email, password: member.password },
      { ...h.meta, country: 'GH', deviceId: 'dev-G' },
    );
    const rows = await h.deps.sessions.list(member.id);
    expect(rows.map((r) => r.country)).toContain('GH');
  });

  it('does not touch another account', async () => {
    const a = await registerMember(h, auth);
    const b = await registerMember(h, auth);
    const sa = await signInActor(h, auth, a);
    const sb = await signInActor(h, auth, b);
    await auth.signOutEverywhere(sa.actor, a.password, h.meta);
    expect(await h.deps.sessions.validate(sb.session.token)).not.toBeNull();
  });
});
