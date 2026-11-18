import { ACCOUNT_ROLES } from '@ad/shared';
import { describe, expect, it } from 'vitest';
import { ADMIN_ACTIONS, can, canAny, requiredRole } from './can';

describe('can(role, action)', () => {
  it('denies every action to viewers and to no role', () => {
    for (const action of ADMIN_ACTIONS) {
      expect(can('viewer', action)).toBe(false);
      expect(can(null, action)).toBe(false);
      expect(can(undefined, action)).toBe(false);
    }
  });

  it('lets editors run the content pipeline', () => {
    for (const action of [
      'admin.access',
      'video.upload',
      'video.edit',
      'video.publish',
      'video.restore',
      'caption.review',
      'series.manage',
      'category.manage',
      'home.curate',
      'analytics.view',
      'account.own',
    ] as const) {
      expect(can('editor', action), action).toBe(true);
    }
  });

  it('keeps admin only capabilities away from editors', () => {
    for (const action of [
      'video.delete',
      'video.purge',
      'caption.override',
      'users.view',
      'users.suspend',
      'settings.theme',
      'settings.site',
      'audit.read',
      'system.view',
    ] as const) {
      expect(can('editor', action), action).toBe(false);
      expect(can('admin', action), action).toBe(true);
      expect(can('super_admin', action), action).toBe(true);
    }
  });

  it('reserves the Super admin stories for super_admin (D-128)', () => {
    for (const action of [
      'roles.view',
      'roles.change',
      'users.delete',
      'settings.flags',
      'audit.security',
      'audit.export',
      'system.jobs',
    ] as const) {
      expect(requiredRole(action), action).toBe('super_admin');
      expect(can('viewer', action), action).toBe(false);
      expect(can('editor', action), action).toBe(false);
      expect(can('admin', action), action).toBe(false);
      expect(can('super_admin', action), action).toBe(true);
    }
  });

  it('gives a Super admin every action', () => {
    for (const action of ADMIN_ACTIONS) expect(can('super_admin', action), action).toBe(true);
  });

  it('never lets a name that only looks like a role through', () => {
    for (const role of ['Super_Admin', 'superadmin', 'super admin', 'constructor', '__proto__']) {
      for (const action of ADMIN_ACTIONS) expect(can(role as never, action)).toBe(false);
    }
  });

  it('gives admins everything editors have', () => {
    for (const action of ADMIN_ACTIONS) {
      if (can('editor', action)) expect(can('admin', action)).toBe(true);
    }
  });

  it('rejects unknown roles and actions (fail closed)', () => {
    expect(can('owner' as never, 'video.edit')).toBe(false);
    expect(can('admin', 'nope' as never)).toBe(false);
  });

  it('covers every account role in the type list', () => {
    for (const role of ACCOUNT_ROLES) expect(typeof can(role, 'admin.access')).toBe('boolean');
  });

  it('canAny is true when one action is allowed', () => {
    expect(canAny('editor', ['audit.read', 'video.edit'])).toBe(true);
    expect(canAny('editor', ['audit.read', 'users.view'])).toBe(false);
  });

  it('names the lowest role that may act', () => {
    expect(requiredRole('video.edit')).toBe('editor');
    expect(requiredRole('audit.read')).toBe('admin');
  });
});
