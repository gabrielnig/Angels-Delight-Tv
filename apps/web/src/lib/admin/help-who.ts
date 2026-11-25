import { ACTION_LABELS } from './can-labels';
import { requiredRole, type AdminAction } from './can';

const ROLE_WORDS = {
  editor: 'Editor and above',
  admin: 'Admin and above',
  super_admin: 'Super admin only',
} as const;

export interface WhoCanDo {
  action: AdminAction;
  label: string;
  role: 'editor' | 'admin' | 'super_admin';
  roleLabel: string;
}

/** The "Who can do this" lines of an article, read from the permission table so they cannot drift (M50-S17). */
export function whoCanDo(actions: readonly string[]): WhoCanDo[] {
  return actions
    .filter((a): a is AdminAction => Object.hasOwn(ACTION_LABELS, a))
    .map((action) => {
      const role = requiredRole(action);
      return { action, label: ACTION_LABELS[action], role, roleLabel: ROLE_WORDS[role] };
    });
}
