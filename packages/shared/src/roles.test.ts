import { describe, expect, it } from 'vitest';
import { ACCOUNT_ROLES } from './enums';
import { isAdminRole, isStaffRole, roleAtLeast, ROLE_RANK } from './roles';

describe('role helpers', () => {
  it('orders viewer, editor, admin, super_admin', () => {
    expect(ACCOUNT_ROLES).toEqual(['viewer', 'editor', 'admin', 'super_admin']);
    expect(ROLE_RANK.super_admin).toBeGreaterThan(ROLE_RANK.admin);
    expect(ROLE_RANK.admin).toBeGreaterThan(ROLE_RANK.editor);
  });

  it('treats a Super admin as an admin and as staff', () => {
    expect(isAdminRole('super_admin')).toBe(true);
    expect(isAdminRole('admin')).toBe(true);
    expect(isAdminRole('editor')).toBe(false);
    expect(isStaffRole('editor')).toBe(true);
    expect(isStaffRole('viewer')).toBe(false);
  });

  it('compares against a minimum and fails closed on anything unknown', () => {
    expect(roleAtLeast('admin', 'super_admin')).toBe(false);
    expect(roleAtLeast('super_admin', 'admin')).toBe(true);
    expect(roleAtLeast('owner', 'editor')).toBe(false);
    expect(roleAtLeast(null, 'editor')).toBe(false);
    expect(roleAtLeast(undefined, 'editor')).toBe(false);
    expect(roleAtLeast('constructor', 'editor')).toBe(false);
  });
});
