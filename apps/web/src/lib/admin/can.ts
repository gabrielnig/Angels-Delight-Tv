import type { AccountRole } from '@ad/shared';

/**
 * Permission matrix from docs/SECURITY.md section 5, as data. The UI uses it to hide or disable
 * controls. It is never the only check: every handler and service re-checks with the same table.
 * Unknown roles and unknown actions are denied (fail closed).
 */
const MATRIX = {
  'admin.access': 'editor',
  'video.upload': 'editor',
  'video.edit': 'editor',
  'video.publish': 'editor',
  'video.restore': 'editor',
  'video.delete': 'admin',
  'video.purge': 'admin',
  'caption.review': 'editor',
  'caption.override': 'admin',
  'series.manage': 'editor',
  'category.manage': 'editor',
  'home.curate': 'editor',
  'analytics.view': 'editor',
  'account.own': 'editor',
  'users.view': 'admin',
  'users.suspend': 'admin',
  'roles.change': 'admin',
  'settings.theme': 'admin',
  'settings.site': 'admin',
  'audit.read': 'admin',
  'system.view': 'admin',
} as const satisfies Record<string, Exclude<AccountRole, 'viewer'>>;

export type AdminAction = keyof typeof MATRIX;
export const ADMIN_ACTIONS = Object.keys(MATRIX) as AdminAction[];

const RANK: Record<AccountRole, number> = { viewer: 0, editor: 1, admin: 2 };

export function requiredRole(action: AdminAction): Exclude<AccountRole, 'viewer'> {
  return MATRIX[action];
}

export function can(role: AccountRole | null | undefined, action: AdminAction): boolean {
  if (!role || !Object.hasOwn(RANK, role)) return false;
  if (!Object.hasOwn(MATRIX, action)) return false;
  return RANK[role] >= RANK[MATRIX[action]];
}

export function canAny(role: AccountRole | null | undefined, actions: readonly AdminAction[]) {
  return actions.some((action) => can(role, action));
}
