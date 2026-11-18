import type { AccountRole } from '@ad/shared';
import type { AdminActor } from './types';

/**
 * Fixture sign in for the admin UI until the auth lane merges. The real implementation replaces
 * `createFixtureAuth` behind the same two calls (password step, code step). Never enabled in
 * production unless ADMIN_FIXTURE_AUTH=on is set on purpose.
 */
export const FIXTURE_PASSWORD = 'fixture-password';
export const FIXTURE_CODE = '123456';
export const SESSION_COOKIE = 'ad_fixture_session';
export const PENDING_COOKIE = 'ad_fixture_pending';

interface FixtureAccount extends AdminActor {
  email: string;
}

const ACCOUNTS: FixtureAccount[] = [
  {
    accountId: 'acc_arkdev',
    email: 'arkdev@example.test',
    name: 'Arkdev',
    role: 'super_admin',
  },
  {
    accountId: 'acc_chiamaka',
    email: 'chiamaka@example.test',
    name: 'Chiamaka Okafor',
    role: 'admin',
  },
  { accountId: 'acc_ngozi', email: 'ngozi@example.test', name: 'Ngozi Eze', role: 'editor' },
  { accountId: 'acc_viewer', email: 'viewer@example.test', name: 'Ada Viewer', role: 'viewer' },
];

const toActor = ({ accountId, role, name }: FixtureAccount): AdminActor => ({
  accountId,
  role,
  name,
});

export type PasswordResult =
  | { ok: true; actor: AdminActor }
  | { ok: false; reason: 'invalid' }
  | { ok: false; reason: 'locked'; retryInMinutes: number };

const MAX_FAILURES = 5;
const LOCK_MS = 15 * 60_000;

export function createFixtureAuth({ now = Date.now }: { now?: () => number } = {}) {
  const failures = new Map<string, { count: number; lockedUntil: number }>();
  const codeFailures = new Map<string, number>();

  return {
    checkPassword(email: string, password: string): PasswordResult {
      const key = email.trim().toLowerCase();
      const state = failures.get(key) ?? { count: 0, lockedUntil: 0 };
      if (state.lockedUntil > now()) {
        return {
          ok: false,
          reason: 'locked',
          retryInMinutes: Math.ceil((state.lockedUntil - now()) / 60_000),
        };
      }
      const account = ACCOUNTS.find((a) => a.email === key);
      const allowed = account && account.role !== 'viewer';
      if (account && allowed && password === FIXTURE_PASSWORD) {
        failures.delete(key);
        return { ok: true, actor: toActor(account) };
      }
      const count = state.lockedUntil && state.lockedUntil <= now() ? 1 : state.count + 1;
      failures.set(key, { count, lockedUntil: count >= MAX_FAILURES ? now() + LOCK_MS : 0 });
      return { ok: false, reason: 'invalid' };
    },

    checkCode(accountId: string, code: string): { ok: true } | { ok: false; triesLeft: number } {
      if (code === FIXTURE_CODE) {
        codeFailures.delete(accountId);
        return { ok: true };
      }
      const used = (codeFailures.get(accountId) ?? 0) + 1;
      codeFailures.set(accountId, used);
      return { ok: false, triesLeft: Math.max(0, MAX_FAILURES - used) };
    },

    actorFor(accountId: string): AdminActor | null {
      const account = ACCOUNTS.find((a) => a.accountId === accountId);
      if (!account) return null;
      return toActor(account);
    },
  };
}

export const ROLE_LABELS: Record<AccountRole, string> = {
  viewer: 'Viewer',
  editor: 'Content editor',
  admin: 'Admin',
  super_admin: 'Super admin',
};

export function fixtureAuthEnabled(env: Record<string, string | undefined> = process.env): boolean {
  if (env.ADMIN_FIXTURE_AUTH === 'on') return true;
  if (env.ADMIN_FIXTURE_AUTH === 'off') return false;
  return env.NODE_ENV !== 'production';
}

/** Email of a fixture account, for screens that show it. */
export function fixtureEmailOf(accountId: string): string {
  return ACCOUNTS.find((a) => a.accountId === accountId)?.email ?? 'unknown@example.test';
}
