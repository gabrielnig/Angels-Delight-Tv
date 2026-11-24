import { describe, expect, it } from 'vitest';
import { decideLink, type LinkFacts } from './link-rules';

const viewer = { id: 'a1', role: 'viewer', status: 'active', verified: true, hasPassword: true };
const facts = (over: Partial<LinkFacts> = {}): LinkFacts => ({
  emailVerified: true,
  identity: null,
  account: null,
  ...over,
});

describe('google link rules (plan slice 5, D-L10-03)', () => {
  it('refuses unverified google email', () => {
    expect(decideLink(facts({ emailVerified: false, account: viewer }))).toEqual({
      action: 'refuse',
      reason: 'unverified_email',
    });
    expect(decideLink(facts({ emailVerified: false, identity: { account: viewer } }))).toEqual({
      action: 'refuse',
      reason: 'unverified_email',
    });
  });

  it('existing identity wins over email change', () => {
    // The identity points at a1 while the address now matches another account: the identity decides.
    const other = { ...viewer, id: 'b2' };
    expect(decideLink(facts({ identity: { account: viewer }, account: other }))).toEqual({
      action: 'sign_in',
      accountId: 'a1',
    });
  });

  it('new email creates account', () => {
    expect(decideLink(facts())).toEqual({ action: 'create' });
  });

  it('verified password account needs confirmation', () => {
    expect(decideLink(facts({ account: viewer }))).toEqual({
      action: 'confirm_link',
      accountId: 'a1',
      proof: 'password',
    });
  });

  it('verified account with no password asks for a password reset first', () => {
    expect(decideLink(facts({ account: { ...viewer, hasPassword: false } }))).toEqual({
      action: 'confirm_link',
      accountId: 'a1',
      proof: 'reset',
    });
  });

  it('unverified password account is adopted and password cleared', () => {
    expect(decideLink(facts({ account: { ...viewer, verified: false } }))).toEqual({
      action: 'adopt',
      accountId: 'a1',
    });
  });

  it('staff role refused, by identity or by email', () => {
    const staff = { ...viewer, role: 'editor' };
    expect(decideLink(facts({ account: staff }))).toEqual({ action: 'refuse', reason: 'staff' });
    expect(decideLink(facts({ identity: { account: staff } }))).toEqual({
      action: 'refuse',
      reason: 'staff',
    });
  });

  it('suspended refused, pending deletion follows password sign in', () => {
    const suspended = { ...viewer, status: 'suspended' };
    expect(decideLink(facts({ identity: { account: suspended } }))).toEqual({
      action: 'refuse',
      reason: 'unavailable',
    });
    expect(decideLink(facts({ account: suspended }))).toEqual({
      action: 'refuse',
      reason: 'unavailable',
    });
    expect(
      decideLink(facts({ identity: { account: { ...viewer, status: 'pending_deletion' } } })),
    ).toEqual({ action: 'sign_in', accountId: 'a1' });
  });

  it('deleted account treated as new', () => {
    expect(decideLink(facts({ account: { ...viewer, status: 'deleted' } }))).toEqual({
      action: 'create',
    });
    expect(decideLink(facts({ identity: { account: { ...viewer, status: 'deleted' } } }))).toEqual({
      action: 'create',
    });
  });
});
