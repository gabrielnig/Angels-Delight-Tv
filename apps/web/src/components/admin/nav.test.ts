import { describe, expect, it } from 'vitest';
import { breadcrumbTrail, isActive, navForRole, NAV_ITEMS } from './nav';

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

  it('shows admins everything and drops empty groups', () => {
    expect(labels('admin')).toHaveLength(NAV_ITEMS.length);
    for (const group of navForRole('editor')) expect(group.items.length).toBeGreaterThan(0);
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

describe('breadcrumbTrail', () => {
  it('builds crumbs from the path with a title for a dynamic id', () => {
    expect(breadcrumbTrail('/admin/videos/abc', { abc: 'Why the Sky Is Blue' })).toEqual([
      { label: 'Admin', href: '/admin' },
      { label: 'Videos', href: '/admin/videos' },
      { label: 'Why the Sky Is Blue' },
    ]);
  });
  it('labels the dashboard root', () => {
    expect(breadcrumbTrail('/admin')).toEqual([{ label: 'Admin' }]);
  });
});
