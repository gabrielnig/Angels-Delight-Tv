import { can } from '@/lib/admin/can';
import type { AdminAction } from '@/lib/admin/can';
import type { AccountRole } from '@ad/shared';
import type { IconName } from './Icon';

export interface NavItem {
  label: string;
  href: string;
  icon: IconName;
  group: string;
  action: AdminAction;
  /** Key in the badge counts map shown beside the label. */
  countKey?: 'encoding' | 'captions';
}

/** Order here is the order in the side menu (SCREEN-ARCHITECTURE 4.2). Items hide by role. */
export const NAV_ITEMS: NavItem[] = [
  {
    label: 'Dashboard',
    href: '/admin',
    icon: 'dashboard',
    group: 'Overview',
    action: 'admin.access',
  },
  {
    label: 'Videos',
    href: '/admin/videos',
    icon: 'video',
    group: 'Content',
    action: 'admin.access',
  },
  {
    label: 'Upload',
    href: '/admin/videos/upload',
    icon: 'upload',
    group: 'Content',
    action: 'video.upload',
  },
  {
    label: 'Encoding',
    href: '/admin/encoding',
    icon: 'encoding',
    group: 'Content',
    action: 'video.edit',
    countKey: 'encoding',
  },
  {
    label: 'Captions',
    href: '/admin/captions',
    icon: 'captions',
    group: 'Content',
    action: 'caption.review',
    countKey: 'captions',
  },
  {
    label: 'Series',
    href: '/admin/series',
    icon: 'series',
    group: 'Content',
    action: 'series.manage',
  },
  {
    label: 'Categories',
    href: '/admin/categories',
    icon: 'categories',
    group: 'Content',
    action: 'category.manage',
  },
  {
    label: 'Trash',
    href: '/admin/videos/trash',
    icon: 'trash',
    group: 'Content',
    action: 'video.restore',
  },
  {
    label: 'Home curation',
    href: '/admin/home',
    icon: 'home',
    group: 'Site',
    action: 'home.curate',
  },
  { label: 'Languages', href: '/admin/languages', icon: 'desktop', group: 'Site', action: 'i18n.edit' },
  { label: 'Theme', href: '/admin/theme', icon: 'theme', group: 'Site', action: 'settings.theme' },
  {
    label: 'Site settings',
    href: '/admin/site-settings',
    icon: 'settings',
    group: 'Site',
    action: 'settings.site',
  },
  {
    label: 'Analytics',
    href: '/admin/analytics',
    icon: 'analytics',
    group: 'Insight and control',
    action: 'analytics.view',
  },
  {
    label: 'Exports',
    href: '/admin/exports',
    icon: 'download',
    group: 'Insight and control',
    action: 'analytics.view',
  },
  {
    label: 'Users',
    href: '/admin/users',
    icon: 'users',
    group: 'Insight and control',
    action: 'users.view',
  },
  {
    label: 'Roles and invites',
    href: '/admin/roles',
    icon: 'roles',
    group: 'Insight and control',
    action: 'roles.view',
  },
  {
    label: 'Audit log',
    href: '/admin/audit-log',
    icon: 'audit',
    group: 'Insight and control',
    action: 'audit.read',
  },
  {
    label: 'System',
    href: '/admin/system',
    icon: 'system',
    group: 'Insight and control',
    action: 'system.view',
  },
  {
    label: 'Sponsors',
    href: '/admin/sponsors',
    icon: 'sponsor',
    group: 'Monetization',
    action: 'sponsor.manage',
  },
  {
    label: 'Donations',
    href: '/admin/donations',
    icon: 'sponsor',
    group: 'Monetization',
    action: 'donation.view',
  },
];

export interface NavGroup {
  name: string;
  items: NavItem[];
}

export function navForRole(role: AccountRole | null | undefined): NavGroup[] {
  const groups: NavGroup[] = [];
  for (const item of NAV_ITEMS) {
    if (!can(role, item.action)) continue;
    let group = groups.find((g) => g.name === item.group);
    if (!group) groups.push((group = { name: item.group, items: [] }));
    group.items.push(item);
  }
  return groups;
}

/** The longest matching nav href wins, so /admin/videos/upload does not light up Videos. */
export function isActive(item: NavItem, pathname: string): boolean {
  if (item.href === '/admin') return pathname === '/admin';
  const match = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  if (!match(item.href)) return false;
  const longer = NAV_ITEMS.some(
    (other) =>
      other.href.length > item.href.length && other.href.startsWith(item.href) && match(other.href),
  );
  return !longer;
}

export interface Crumb {
  label: string;
  href?: string;
}

