import type { BulkIssue, BulkOutcome, BulkUndo } from './bulk';
import type { AdminActor } from './types';
import type { CommandResult } from './video-commands';
import type { PeopleService } from './services';

/** Each action touches sessions or sends email, so this is lower than the shared call limit. */
export const MAX_USER_BULK = 50;

export type UserBulkAction =
  | { type: 'suspend'; reason: string }
  | { type: 'reinstate' }
  | { type: 'sign_out'; reason: string };

export interface UserBulkService {
  list(): Promise<Array<{ id: string; status: 'active' | 'suspended'; suspendedReason: string | null }>>;
  suspend(id: string, reason: string): Promise<CommandResult>;
  reinstate(id: string): Promise<CommandResult>;
  signOut(id: string, reason: string): Promise<CommandResult>;
}

export type UserUndoStep =
  | { type: 'reinstate'; ids: string[] }
  | { type: 'suspend'; reason: string; ids: string[] };

const reasonOk = (reason: string) => reason.trim().length >= 3;

/**
 * Runs a support action over viewer accounts, one at a time (L3-D14). The acting account is never touched,
 * suspended accounts are skipped by Suspend and active ones by Reinstate. Suspend and Reinstate are
 * undoable. Force sign out is not.
 */
export async function runUserBulk(
  service: UserBulkService,
  actorId: string,
  ids: readonly string[],
  action: UserBulkAction,
  bulkId: string,
): Promise<BulkOutcome> {
  const out: BulkOutcome = { bulkId, succeeded: [], failed: [], skipped: [] };
  const unique = [...new Set(ids)];
  const refuse = (reason: string) => {
    out.failed = unique.map((id): BulkIssue => ({ id, reason, retryable: false }));
    return out;
  };
  if (unique.length > MAX_USER_BULK) return refuse(`Choose ${MAX_USER_BULK} accounts or fewer at a time.`);
  if (action.type !== 'reinstate' && !reasonOk(action.reason))
    return refuse('Write a short reason. It is kept in the audit log.');
  const before = new Map((await service.list()).map((u) => [u.id, u]));
  const undoReinstate: string[] = [];
  const undoSuspend = new Map<string, string[]>();
  for (const id of unique) {
    if (id === actorId) {
      out.skipped.push({ id, reason: 'You cannot do this to your own account.' });
      continue;
    }
    const user = before.get(id);
    if (!user) {
      out.failed.push({ id, reason: 'That account no longer exists.', retryable: false });
      continue;
    }
    if (action.type === 'suspend' && user.status === 'suspended') {
      out.skipped.push({ id, reason: 'Already suspended.' });
      continue;
    }
    if (action.type === 'reinstate' && user.status === 'active') {
      out.skipped.push({ id, reason: 'Already active.' });
      continue;
    }
    try {
      const done =
        action.type === 'suspend'
          ? await service.suspend(id, action.reason)
          : action.type === 'reinstate'
            ? await service.reinstate(id)
            : await service.signOut(id, action.reason);
      if (!done.ok) {
        out.failed.push({ id, reason: done.error, retryable: false });
        continue;
      }
      out.succeeded.push(id);
      if (action.type === 'suspend') undoReinstate.push(id);
      if (action.type === 'reinstate') {
        const reason = user.suspendedReason ?? 'Suspended earlier';
        undoSuspend.set(reason, [...(undoSuspend.get(reason) ?? []), id]);
      }
    } catch {
      out.failed.push({ id, reason: 'That did not work. Try again.', retryable: true });
    }
  }
  const steps: UserUndoStep[] = [];
  if (undoReinstate.length) steps.push({ type: 'reinstate', ids: undoReinstate });
  for (const [reason, group] of undoSuspend) steps.push({ type: 'suspend', reason, ids: group });
  if (steps.length)
    out.undo = { label: action.type === 'suspend' ? 'Suspend' : 'Reinstate', payload: steps };
  return out;
}

/** Compare and set: an account is only put back while it is still in the state the run left it in. */
export function planUserUndo(
  undo: BulkUndo,
  current: Record<string, 'active' | 'suspended'>,
): UserUndoStep[] {
  const out: UserUndoStep[] = [];
  for (const step of undo.payload as UserUndoStep[]) {
    const want = step.type === 'reinstate' ? 'suspended' : 'active';
    const ids = step.ids.filter((id) => current[id] === want);
    if (ids.length) out.push({ ...step, ids });
  }
  return out;
}

export async function undoUserBulk(
  service: UserBulkService,
  actorId: string,
  undo: BulkUndo,
): Promise<{ succeeded: string[]; failed: BulkIssue[] }> {
  const current = Object.fromEntries((await service.list()).map((u) => [u.id, u.status]));
  const out = { succeeded: [] as string[], failed: [] as BulkIssue[] };
  for (const step of planUserUndo(undo, current)) {
    for (const id of step.ids.filter((i) => i !== actorId)) {
      const done =
        step.type === 'reinstate' ? await service.reinstate(id) : await service.suspend(id, step.reason);
      if (done.ok) out.succeeded.push(id);
      else out.failed.push({ id, reason: done.error });
    }
  }
  return out;
}

/** Adapts the people service to what a bulk run needs. */
export function userBulkFor(
  service: Pick<PeopleService, 'users' | 'suspend' | 'reinstate' | 'revokeSessions'>,
  actor: AdminActor,
): UserBulkService {
  return {
    async list() {
      return (await service.users(actor, {})).map((u) => ({
        id: u.id,
        status: u.status,
        suspendedReason: u.suspendedReason,
      }));
    },
    suspend: (id, reason) => service.suspend(actor, id, reason),
    reinstate: (id) => service.reinstate(actor, id),
    signOut: (id, reason) => service.revokeSessions(actor, id, reason),
  };
}
