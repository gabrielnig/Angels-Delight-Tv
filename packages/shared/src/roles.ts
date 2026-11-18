import type { AccountRole } from './enums';

/** Order of the account roles. A higher rank includes everything a lower rank may do. */
export const ROLE_RANK: Readonly<Record<AccountRole, number>> = {
  viewer: 0,
  editor: 1,
  admin: 2,
  super_admin: 3,
};

/** True only for a known role at or above `minimum`. Unknown, missing and inherited names are refused. */
export function roleAtLeast(role: unknown, minimum: AccountRole): boolean {
  if (typeof role !== 'string' || !Object.hasOwn(ROLE_RANK, role)) return false;
  return ROLE_RANK[role as AccountRole] >= ROLE_RANK[minimum];
}

/** Editor, admin or super_admin. */
export const isStaffRole = (role: unknown): role is Exclude<AccountRole, 'viewer'> =>
  roleAtLeast(role, 'editor');

/** Admin or super_admin. */
export const isAdminRole = (role: unknown): role is 'admin' | 'super_admin' =>
  roleAtLeast(role, 'admin');

/** Only super_admin. */
export const isSuperAdminRole = (role: unknown): role is 'super_admin' => role === 'super_admin';
