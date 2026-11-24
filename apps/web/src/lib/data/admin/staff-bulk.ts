import type { BulkOutcome } from './bulk';
import type { CommandResult } from './video-commands';

export const MAX_RESEND_BULK = 20;
export const MAX_ROLE_BULK = 50;
const HOUR = 3_600_000;

export type StaffBulkAction = { type: 'role'; role: 'editor' | 'admin' } | { type: 'resend_invites' };

export interface StaffBulkService {
  staff(): Promise<Array<{ id: string; role: 'editor' | 'admin' | 'super_admin' }>>;
  invites(): Promise<Array<{ id: string; createdAt: string }>>;
  changeRole(id: string, role: 'editor' | 'admin'): Promise<CommandResult>;
  resend(id: string): Promise<CommandResult>;
}

const ROLE_WORD = { editor: 'an Editor', admin: 'an Admin' } as const;

/**
 * Staff bulk actions (L3-D11). Super admin only; the caller checks `roles.bulk` and the recent password
 * confirmation. Role change is limited to Editor and Admin, to and from, and refuses the whole batch if it
 * names the actor or anyone who is or would become a Super admin. No undo for staff changes.
 */
export async function runStaffBulk(
  service: StaffBulkService,
  actorId: string,
  ids: readonly string[],
  action: StaffBulkAction,
  bulkId: string,
  now: number,
): Promise<BulkOutcome> {
  const out: BulkOutcome = { bulkId, succeeded: [], failed: [], skipped: [] };
  const unique = [...new Set(ids)];
  const refuse = (reason: string) => {
    out.failed = unique.map((id) => ({ id, reason, retryable: false }));
    return out;
  };

  if (action.type === 'resend_invites') {
    if (unique.length > MAX_RESEND_BULK)
      return refuse(`Choose ${MAX_RESEND_BULK} invites or fewer at a time.`);
    const known = new Map((await service.invites()).map((i) => [i.id, i]));
    for (const id of unique) {
      const invite = known.get(id);
      if (!invite) out.skipped.push({ id, reason: 'That invite is no longer pending.' });
      else if (now - Date.parse(invite.createdAt) < HOUR)
        out.skipped.push({ id, reason: 'Sent less than an hour ago.' });
      else {
        try {
          const done = await service.resend(id);
          if (done.ok) out.succeeded.push(id);
          else out.failed.push({ id, reason: done.error, retryable: false });
        } catch {
          out.failed.push({ id, reason: 'That did not work. Try again.', retryable: true });
        }
      }
    }
    return out;
  }

  if (unique.length > MAX_ROLE_BULK) return refuse(`Choose ${MAX_ROLE_BULK} people or fewer at a time.`);
  if (unique.includes(actorId)) return refuse('You cannot change your own role.');
  if ((action.role as string) === 'super_admin')
    return refuse('Moving anyone to or from Super admin is done one at a time.');
  const people = new Map((await service.staff()).map((m) => [m.id, m]));
  if (unique.some((id) => people.get(id)?.role === 'super_admin'))
    return refuse('Moving anyone to or from Super admin is done one at a time.');
  for (const id of unique) {
    const person = people.get(id);
    if (!person) {
      out.failed.push({ id, reason: 'That person was not found.', retryable: false });
      continue;
    }
    if (person.role === action.role) {
      out.skipped.push({ id, reason: `Already ${ROLE_WORD[action.role]}.` });
      continue;
    }
    try {
      const done = await service.changeRole(id, action.role);
      if (done.ok) out.succeeded.push(id);
      else out.failed.push({ id, reason: done.error, retryable: false });
    } catch {
      out.failed.push({ id, reason: 'That did not work. Try again.', retryable: true });
    }
  }
  return out;
}
