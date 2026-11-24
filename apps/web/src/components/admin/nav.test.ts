import { describe, expect, it } from 'vitest';
import { isActive, navForRole, NAV_ITEMS } from './nav';

const labels = (role: Parameters<typeof navForRole>[0]) =>
  navForRole(role).flatMap((group) => group.items.map((item) => item.label));

describe('navForRole', () => {
  it('shows nothing to viewers', () => {
    expect(navForRole('viewer')).toEqual([]);
  });

  it('shows editors the content pipeline but not admin only pages', () => {
    const names = labels('editor');
    expect(names).toEqual(
      expect.arrayContaining([
        'Dashboard',
        'Videos',
        'Upload',
        'Encoding',
        'Captions',
        'Series',
        'Categories',
        'Trash',
        'Home curation',
        'Analytics',
        'Exports',
      ]),
    );
    for (const hidden of [
      'Users',
      'Audit log',
      'Roles and invites',
      'System',
      'Theme',
      'Site settings',
    ]) {
      expect(names).not.toContain(hidden);
    }
  });

  it('shows a Super admin everything and drops empty groups', () => {
    expect(labels('super_admin')).toHaveLength(NAV_ITEMS.length);
    for (const group of navForRole('editor')) expect(group.items.length).toBeGreaterThan(0);
  });

  it('hides Roles and invites from an admin and keeps the rest (M12-S07 AC2)', () => {
    expect(labels('admin')).not.toContain('Roles and invites');
    expect(labels('admin')).toHaveLength(NAV_ITEMS.length - 1);
    for (const group of navForRole('editor')) expect(group.items.length).toBeGreaterThan(0);
  });
});

describe('Monetization group (M48)', () => {
  it('shows Sponsors to editors and above, not to viewers', () => {
    expect(labels('editor')).toContain('Sponsors');
    expect(labels('admin')).toContain('Sponsors');
    expect(labels('viewer')).not.toContain('Sponsors');
    const group = navForRole('editor').find((g) => g.items.some((i) => i.label === 'Sponsors'));
    expect(group?.name).toBe('Monetization');
  });
});

describe('Donations entry (M48-S36)', () => {
  it('shows Donations to admins only, in the Monetization group', () => {
    expect(labels('admin')).toContain('Donations');
    expect(labels('editor')).not.toContain('Donations');
    expect(labels('viewer')).not.toContain('Donations');
    expect(navForRole('admin').find((g) => g.items.some((i) => i.label === 'Donations'))?.name).toBe('Monetization');
  });
});

describe('isActive', () => {
  const videos = NAV_ITEMS.find((item) => item.label === 'Videos')!;
  const upload = NAV_ITEMS.find((item) => item.label === 'Upload')!;
  const dashboard = NAV_ITEMS.find((item) => item.label === 'Dashboard')!;

  it('matches the exact page and its children', () => {
    expect(isActive(videos, '/admin/videos')).toBe(true);
    expect(isActive(videos, '/admin/videos/abc')).toBe(true);
  });
  it('does not match siblings that share a prefix', () => {
    expect(isActive(videos, '/admin/videos/upload')).toBe(false);
    expect(isActive(upload, '/admin/videos/upload')).toBe(true);
    expect(isActive(videos, '/admin/videos/trash')).toBe(false);
  });
  it('dashboard matches only the root', () => {
    expect(isActive(dashboard, '/admin')).toBe(true);
    expect(isActive(dashboard, '/admin/videos')).toBe(false);
  });
});

