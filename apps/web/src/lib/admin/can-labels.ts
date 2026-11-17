import type { AdminAction } from './can';

/** Plain language names for the permission table. Every action in the matrix has one. */
export const ACTION_LABELS: Record<AdminAction, string> = {
  'admin.access': 'Open the admin area',
  'video.upload': 'Upload videos',
  'video.edit': 'Edit video details',
  'video.publish': 'Publish and schedule videos',
  'video.restore': 'Restore videos from Trash',
  'video.delete': 'Move videos to Trash',
  'video.purge': 'Delete videos for good',
  'caption.review': 'Review and approve captions',
  'caption.override': 'Publish without approved captions',
  'series.manage': 'Manage series',
  'category.manage': 'Manage categories',
  'home.curate': 'Curate the Home page',
  'analytics.view': 'See analytics',
  'account.own': 'Manage their own account',
  'users.view': 'See viewer accounts',
  'users.suspend': 'Suspend viewer accounts',
  'roles.change': 'Invite people and change roles',
  'settings.theme': 'Change the theme',
  'settings.site': 'Change site settings',
  'audit.read': 'Read the audit log',
  'system.view': 'See system health',
};
