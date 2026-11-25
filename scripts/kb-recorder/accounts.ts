import type { EpisodeRole } from './episode';

/**
 * The staff accounts of the demo stack. Fixture mode uses the accounts built into the app fixtures
 * (apps/web/src/lib/data/admin/session.ts). Only reserved example domains, never a real address.
 */
export interface DemoAccount {
  email: string;
  password: string;
  name: string;
}

export const FIXTURE_CODE = '123456';

export const DEMO_ACCOUNTS: Record<Exclude<EpisodeRole, 'none'>, DemoAccount> = {
  editor: { email: 'ngozi@example.test', password: 'fixture-password', name: 'Ngozi Eze' },
  admin: { email: 'chiamaka@example.test', password: 'fixture-password', name: 'Chiamaka Okafor' },
  super_admin: { email: 'arkdev@example.test', password: 'fixture-password', name: 'Arkdev' },
};

export function accountFor(role: EpisodeRole): DemoAccount {
  if (role === 'none') throw new Error('A signed out episode has no account');
  return DEMO_ACCOUNTS[role];
}
