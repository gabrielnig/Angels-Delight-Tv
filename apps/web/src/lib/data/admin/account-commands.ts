import { checkPassword } from '@ad/auth/policy';
import { FIXTURE_CODE, FIXTURE_PASSWORD } from './session';
import type { AdminStore } from './store';
import type { AdminActor, MyAccount } from './types';
import { pushAudit } from './users-commands';

export type FieldResult = { ok: true } | { ok: false; field: string; error: string };
const fail = (field: string, error: string) => ({ ok: false as const, field, error });
const OK: FieldResult = { ok: true };
const iso = (ms: number) => new Date(ms).toISOString();

export function ensureAccount(
  s: AdminStore,
  actor: AdminActor,
  email: string,
  now: number,
): MyAccount {
  const existing = s.accounts[actor.accountId];
  if (existing) return existing;
  // The knowledge base demo (KB_DEMO=on) shows staff on emailed codes, the default second step (D-397).
  const demo = process.env.KB_DEMO === 'on';
  const account: MyAccount = {
    accountId: actor.accountId,
    name: actor.name,
    email,
    twoFactor: !demo,
    recoveryCodesLeft: demo ? 0 : 8,
    passwordChangedAt: null,
    ...(demo
      ? {
          secondStep: 'email' as const,
          security: { method: 'email' as const, canUseEmail: true, testedRecently: false },
          trustedDevices: [
            {
              id: `${actor.accountId}_td1`,
              label: 'Chrome on Windows',
              place: 'Lagos, Nigeria',
              lastUsedAt: iso(now - 86_400_000),
              expiresAt: iso(now + 29 * 86_400_000),
            },
          ],
        }
      : {}),
    sessions: [
      {
        id: `${actor.accountId}_s1`,
        device: 'This browser',
        place: 'Lagos, Nigeria',
        lastActiveAt: iso(now),
        current: true,
      },
      {
        id: `${actor.accountId}_s2`,
        device: 'Phone, Chrome',
        place: 'Lagos, Nigeria',
        lastActiveAt: iso(now - 3 * 3_600_000),
        current: false,
      },
      {
        id: `${actor.accountId}_s3`,
        device: 'Laptop, Firefox',
        place: 'Abuja, Nigeria',
        lastActiveAt: iso(now - 2 * 86_400_000),
        current: false,
      },
    ],
  };
  s.accounts[actor.accountId] = account;
  return account;
}

const mine = (s: AdminStore, actor: AdminActor) => s.accounts[actor.accountId];

export function updateName(
  s: AdminStore,
  actor: AdminActor,
  raw: string,
  now: number,
): FieldResult {
  const account = mine(s, actor);
  if (!account) return fail('name', 'Account not found.');
  const name = raw.trim().replace(/\s+/g, ' ');
  if (name.length < 2) return fail('name', 'Use at least 2 characters.');
  if (name.length > 60) return fail('name', 'Use 60 characters or fewer.');
  const before = account.name;
  account.name = name;
  pushAudit(
    s,
    {
      action: 'account.update',
      targetType: 'account',
      targetId: actor.accountId,
      summary: 'Changed their display name',
      before: { name: before },
      after: { name },
    },
    actor.accountId,
    name,
    now,
  );
  return OK;
}

/** The fixture checks the shared fixture password. The real service verifies the argon2id hash. */
export function changePassword(
  s: AdminStore,
  actor: AdminActor,
  current: string,
  next: string,
  confirm: string,
  code: string,
  now: number,
): FieldResult {
  const account = mine(s, actor);
  if (!account) return fail('current', 'Account not found.');
  if (code !== FIXTURE_CODE) return fail('code', 'That code is not right.');
  if (current !== FIXTURE_PASSWORD) return fail('current', 'That is not your current password.');
  const check = checkPassword(next, account.email);
  if (!check.ok)
    return fail(
      'next',
      check.rules.find((r) => r.passed === false)?.label ?? 'Choose a stronger password.',
    );
  if (next === current) return fail('next', 'Choose a password you have not used here before.');
  if (next !== confirm) return fail('confirm', 'The two passwords do not match.');
  account.passwordChangedAt = iso(now);
  account.sessions = account.sessions.filter((x) => x.current);
  pushAudit(
    s,
    {
      action: 'account.password_change',
      targetType: 'account',
      targetId: actor.accountId,
      summary: 'Changed their password and signed out other devices',
    },
    actor.accountId,
    account.name,
    now,
  );
  return OK;
}

export function revokeSession(
  s: AdminStore,
  actor: AdminActor,
  sessionId: string,
  now: number,
): FieldResult {
  const account = mine(s, actor);
  const session = account?.sessions.find((x) => x.id === sessionId);
  if (!account || !session) return fail('session', 'That session is already gone.');
  if (session.current)
    return fail('session', 'This is the device you are using. Sign out from the menu instead.');
  account.sessions = account.sessions.filter((x) => x.id !== sessionId);
  pushAudit(
    s,
    {
      action: 'session.revoke',
      targetType: 'session',
      targetId: sessionId,
      summary: `Signed out ${session.device}`,
    },
    actor.accountId,
    account.name,
    now,
  );
  return OK;
}

export function regenerateRecoveryCodes(
  s: AdminStore,
  actor: AdminActor,
  code: string,
  generate: () => string,
  now: number,
): { ok: false; field: string; error: string } | { ok: true; codes: string[] } {
  const account = mine(s, actor);
  if (!account) return fail('code', 'Account not found.');
  if (code !== FIXTURE_CODE) return fail('code', 'That code is not right.');
  const codes = Array.from({ length: 10 }, generate);
  account.recoveryCodesLeft = 10;
  pushAudit(
    s,
    {
      action: 'mfa.recovery_regenerate',
      targetType: 'account',
      targetId: actor.accountId,
      summary: 'Made new recovery codes',
    },
    actor.accountId,
    account.name,
    now,
  );
  return { ok: true, codes };
}
