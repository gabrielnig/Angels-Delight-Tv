import type { Actor } from '@ad/shared';

/** The viewer API always acts as a viewer, so a staff session never runs viewer calls with staff read rights (L-1). */
export function viewerActorFor(session: { accountId: string; role?: string }): Actor {
  return { accountId: session.accountId, role: 'viewer' };
}
