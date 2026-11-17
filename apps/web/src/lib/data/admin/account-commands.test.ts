import { describe, expect, it } from 'vitest';
import {
  changePassword,
  ensureAccount,
  regenerateRecoveryCodes,
  revokeSession,
  updateName,
} from './account-commands';
import { FIXTURE_PASSWORD } from './session';
import { getStore } from './store';

const NOW = Date.parse('2026-11-17T10:00:00Z');
const actor = { accountId: 'acc_chiamaka', role: 'admin' as const, name: 'Chiamaka Okafor' };
const fresh = () => structuredClone(getStore());
const STRONG = 'purple-mango-river-42';

describe('ensureAccount', () => {
  it('creates a record with one current session', () => {
    const s = fresh();
    const a = ensureAccount(s, actor, 'chiamaka@example.test', NOW);
    expect(a.sessions.filter((x) => x.current)).toHaveLength(1);
    expect(ensureAccount(s, actor, 'chiamaka@example.test', NOW)).toBe(a);
  });
});

describe('updateName', () => {
  it('trims and bounds the name', () => {
    const s = fresh();
    ensureAccount(s, actor, 'c@example.test', NOW);
    expect(updateName(s, actor, '  Chi  Okafor ', NOW).ok).toBe(true);
    expect(s.accounts[actor.accountId]!.name).toBe('Chi Okafor');
    expect(updateName(s, actor, 'a', NOW).ok).toBe(false);
    expect(updateName(s, actor, 'x'.repeat(61), NOW).ok).toBe(false);
  });
});

describe('changePassword', () => {
  const setup = () => {
    const s = fresh();
    ensureAccount(s, actor, 'chiamaka@example.test', NOW);
    return s;
  };
  it('needs the current password', () => {
    const r = changePassword(setup(), actor, 'wrong', STRONG, STRONG, NOW);
    expect(r).toEqual({ ok: false, field: 'current', error: 'That is not your current password.' });
  });
  it('rejects weak, mismatched and unchanged passwords', () => {
    const s = setup();
    expect(changePassword(s, actor, FIXTURE_PASSWORD, 'short', 'short', NOW)).toMatchObject({
      ok: false,
      field: 'next',
    });
    expect(changePassword(s, actor, FIXTURE_PASSWORD, STRONG, STRONG + 'x', NOW)).toMatchObject({
      ok: false,
      field: 'confirm',
    });
    expect(
      changePassword(s, actor, FIXTURE_PASSWORD, FIXTURE_PASSWORD, FIXTURE_PASSWORD, NOW),
    ).toMatchObject({ ok: false, field: 'next' });
  });
  it('signs out other devices and audits it', () => {
    const s = setup();
    expect(changePassword(s, actor, FIXTURE_PASSWORD, STRONG, STRONG, NOW).ok).toBe(true);
    expect(s.accounts[actor.accountId]!.sessions.every((x) => x.current)).toBe(true);
    expect(s.accounts[actor.accountId]!.passwordChangedAt).toBe(new Date(NOW).toISOString());
    expect(s.audit[0]).toMatchObject({
      action: 'account.password_change',
      actorId: actor.accountId,
    });
    expect(JSON.stringify(s.audit[0])).not.toContain(STRONG);
  });
});

describe('sessions', () => {
  it('revokes another session but never the current one', () => {
    const s = fresh();
    const a = ensureAccount(s, actor, 'c@example.test', NOW);
    const other = a.sessions.find((x) => !x.current)!;
    expect(revokeSession(s, actor, a.sessions.find((x) => x.current)!.id, NOW).ok).toBe(false);
    expect(revokeSession(s, actor, other.id, NOW).ok).toBe(true);
    expect(a.sessions.some((x) => x.id === other.id)).toBe(false);
  });
});

describe('recovery codes', () => {
  it('needs the password and returns ten fresh codes', () => {
    const s = fresh();
    ensureAccount(s, actor, 'c@example.test', NOW);
    let n = 0;
    const gen = () => `code-${++n}`;
    expect(regenerateRecoveryCodes(s, actor, 'nope', gen, NOW).ok).toBe(false);
    const r = regenerateRecoveryCodes(s, actor, FIXTURE_PASSWORD, gen, NOW);
    expect(r.ok && r.codes).toHaveLength(10);
    expect(s.accounts[actor.accountId]!.recoveryCodesLeft).toBe(10);
    expect(JSON.stringify(s.audit[0])).not.toContain('code-1');
  });
});
