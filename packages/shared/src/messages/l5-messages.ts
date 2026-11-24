/**
 * Copy for lane L5 (module M44): viewer notifications, notification settings, Continue learning and My List
 * controls. Kept in its own file and spread into `EN_NG`. Keys follow `area.kind.name`.
 */
export const L5_MESSAGES = {
  'engage.notices.title': 'Notifications',
  'engage.notices.bell': 'Notifications',
  'engage.notices.unreadSpoken': {
    one: '{count} unread notification',
    other: '{count} unread notifications',
  },
  'engage.notices.noneUnread': 'No unread notifications',
  'engage.notices.unreadMark': 'Unread. ',
  'engage.notices.markAll': 'Mark all as read',
  'engage.notices.seeAll': 'See all',
  'engage.notices.kindEpisodes': 'New episodes',
  'engage.notices.kindVideos': 'New videos',
  'engage.notices.emptyTitle': 'Nothing new',
  'engage.notices.emptyBody': 'We will tell you when something arrives.',
  'engage.notices.loading': 'Loading',
  'engage.notices.error': 'We could not load notifications. Try again.',
  'engage.notices.retry': 'Try again',
  'engage.notices.dataSaver': 'Data saver is on. The count updates when you open the bell.',
  'engage.notices.more': 'Show more',
  'engage.notices.kidsTitle': 'This is not available on this profile',
  'engage.notices.kidsBody': 'Switch to an adult profile to see notifications.',
  'engage.notices.kidsAction': 'Switch profile',
  'engage.notices.today': 'Today, {time}',
  'engage.notices.yesterday': 'Yesterday',
} as const;
