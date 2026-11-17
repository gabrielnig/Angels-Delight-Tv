import type { Actor } from '@ad/shared';

/**
 * The actor for viewer reads and writes. The viewer services act on the signed in account's own data, so the
 * role only matters for staff tools and is always `viewer` here. The session was checked by the page or action
 * before this runs, and every service re-checks ownership against this account id.
 */
export const viewerActor = (accountId: string): Actor => ({ accountId, role: 'viewer' });
