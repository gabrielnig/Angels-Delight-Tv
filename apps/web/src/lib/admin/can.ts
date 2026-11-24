import { roleAtLeast, type AccountRole } from '@ad/shared';

/**
 * Permission matrix from docs/SECURITY.md section 5, as data. The UI uses it to hide or disable
 * controls. It is never the only check: every handler and service re-checks with the same table.
 * Unknown roles and unknown actions are denied (fail closed).
 */
const MATRIX = {
  'admin.access': 'editor',
  'video.upload': 'editor',
  'video.edit': 'editor',
  'video.markers': 'editor',
  'video.publish': 'editor',
  'video.restore': 'editor',
  'video.delete': 'admin',
  'video.purge': 'admin',
  'caption.review': 'editor',
  'caption.override': 'admin',
  'caption.approve_bulk': 'admin',
  'caption.availability': 'admin',
  'encode.retry': 'editor',
  'series.manage': 'editor',
  'series.delete': 'admin',
  'category.manage': 'editor',
  'home.curate': 'editor',
  'analytics.view': 'editor',
  'account.own': 'editor',
  'users.view': 'admin',
  'users.suspend': 'admin',
  'users.bulk': 'admin',
  'users.delete': 'super_admin',
  'roles.view': 'super_admin',
  'roles.change': 'super_admin',
  'roles.bulk': 'super_admin',
  'settings.theme': 'admin',
  'settings.site': 'admin',
  'settings.flags': 'super_admin',
  'audit.read': 'admin',
  'audit.security': 'super_admin',
  'audit.export': 'super_admin',
  'i18n.edit': 'editor',
  'i18n.approve': 'admin',
  'i18n.publish': 'admin',
  'i18n.override': 'super_admin',
  'system.view': 'admin',
  'system.jobs': 'super_admin',
} as const satisfies Record<string, Exclude<AccountRole, 'viewer'>>;

export type AdminAction = keyof typeof MATRIX;
export const ADMIN_ACTIONS = Object.keys(MATRIX) as AdminAction[];

export function requiredRole(action: AdminAction): Exclude<AccountRole, 'viewer'> {
  return MATRIX[action];
}

export function can(role: AccountRole | null | undefined, action: AdminAction): boolean {
  if (!Object.hasOwn(MATRIX, action)) return false;
  return roleAtLeast(role, MATRIX[action]);
}

export function canAny(role: AccountRole | null | undefined, actions: readonly AdminAction[]) {
  return actions.some((action) => can(role, action));
}
