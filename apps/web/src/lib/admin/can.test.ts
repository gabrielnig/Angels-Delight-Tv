import { ACCOUNT_ROLES } from '@ad/shared';
import { describe, expect, it } from 'vitest';
import { ADMIN_ACTIONS, can, canAny, requiredRole } from './can';

describe('L3 bulk and captions permissions (R21, R22)', () => {
  it('caption.availability is admin and caption.approve_bulk is admin', () => {
    for (const action of ['caption.availability', 'caption.approve_bulk', 'series.delete', 'users.bulk'] as const) {
      expect(requiredRole(action), action).toBe('admin');
      expect(can('editor', action), action).toBe(false);
      expect(can('admin', action), action).toBe(true);
    }
  });

  it('encode.retry stays at editor level and roles.bulk is Super admin only', () => {
    expect(requiredRole('encode.retry')).toBe('editor');
    expect(can('editor', 'encode.retry')).toBe(true);
    expect(requiredRole('roles.bulk')).toBe('super_admin');
    expect(can('admin', 'roles.bulk')).toBe(false);
  });

  it('every new action has a plain language label', async () => {
    const { ACTION_LABELS } = await import('./can-labels');
    for (const action of ['caption.availability', 'caption.approve_bulk', 'encode.retry', 'series.delete', 'users.bulk', 'roles.bulk'] as const) {
      expect(ACTION_LABELS[action], action).toMatch(/\w/);
    }
  });
});

describe('can(role, action)', () => {
  it('denies every action to viewers and to no role', () => {
    for (const action of ADMIN_ACTIONS) {
      expect(can('viewer', action)).toBe(false);
      expect(can(null, action)).toBe(false);
      expect(can(undefined, action)).toBe(false);
    }
  });

  it('lets editors edit markers and denies viewers and unknown roles', () => {
    expect(can('editor', 'video.markers')).toBe(true);
    expect(can('admin', 'video.markers')).toBe(true);
    expect(can('viewer', 'video.markers')).toBe(false);
    expect(can('owner' as never, 'video.markers')).toBe(false);
    expect(requiredRole('video.markers')).toBe('editor');
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

  it('gives Editors i18n.edit, Admins approve and publish, and Super admins the threshold override (M46)', () => {
    expect(requiredRole('i18n.edit')).toBe('editor');
    expect(requiredRole('i18n.approve')).toBe('admin');
    expect(requiredRole('i18n.publish')).toBe('admin');
    expect(requiredRole('i18n.override')).toBe('super_admin');
    expect(can('viewer', 'i18n.edit')).toBe(false);
    expect(can('editor', 'i18n.approve')).toBe(false);
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

describe('sponsors permissions (M48, D-263)', () => {
  it('editors manage drafts, only admins go live, report exports are admin only', () => {
    expect(requiredRole('sponsor.manage')).toBe('editor');
    expect(requiredRole('sponsor.activate')).toBe('admin');
    expect(requiredRole('sponsor.report.export')).toBe('admin');
    expect(can('editor', 'sponsor.manage')).toBe(true);
    expect(can('editor', 'sponsor.activate')).toBe(false);
    expect(can('editor', 'sponsor.report.export')).toBe(false);
    expect(can('viewer', 'sponsor.manage')).toBe(false);
  });

  it('has plain language labels', async () => {
    const { ACTION_LABELS } = await import('./can-labels');
    for (const action of ['sponsor.manage', 'sponsor.activate', 'sponsor.report.export'] as const) {
      expect(ACTION_LABELS[action], action).toMatch(/\w/);
    }
  });
});
