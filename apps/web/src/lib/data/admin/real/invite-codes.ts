import 'server-only';
import type { SignupInviteSummary } from '@ad/auth';
import { adminRuntime } from '@/server/admin/runtime';
import type { InviteCodeDto, InviteCodeResult, InviteCodesService } from '../site-types';
import { catalogActor, need } from './shared';
import { staffFailure } from './staff-errors';

const toDto = (row: SignupInviteSummary): InviteCodeDto => ({
  id: row.id,
  label: row.label,
  hint: row.hint,
  uses: row.uses,
  maxUses: row.maxUses,
  expiresAt: row.expiresAt?.toISOString() ?? null,
  createdAt: row.createdAt.toISOString(),
  status: row.status,
});

const staffActor = (actor: Parameters<typeof catalogActor>[0]) => ({
  ...catalogActor(actor),
  sessionId: actor.sessionId ?? '',
});

/** Invite codes for viewer sign up (M29-S03) on the lane B staff service. */
export const realInviteCodes: InviteCodesService = {
  async list(actor) {
    need(actor, 'settings.site');
    const rows = await adminRuntime().auth().staff.listSignupInvites(staffActor(actor));
    return rows.map(toDto);
  },

  async create(actor, input): Promise<InviteCodeResult> {
    try {
      need(actor, 'settings.site');
      const rt = adminRuntime();
      const who = staffActor(actor);
      const made = await rt.auth().staff.createSignupInvite(
        who,
        {
          label: input.label,
          maxUses: input.maxUses,
          expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
        },
        await rt.meta(),
      );
      const rows = await rt.auth().staff.listSignupInvites(who);
      return { ok: true, invites: rows.map(toDto), code: made.code };
    } catch (error) {
      const failure = staffFailure(error);
      return { ok: false, error: failure.ok ? 'Something went wrong.' : failure.error };
    }
  },

  async revoke(actor, id): Promise<InviteCodeResult> {
    try {
      need(actor, 'settings.site');
      const rt = adminRuntime();
      const who = staffActor(actor);
      await rt.auth().staff.revokeSignupInvite(who, id, await rt.meta());
      const rows = await rt.auth().staff.listSignupInvites(who);
      return { ok: true, invites: rows.map(toDto) };
    } catch (error) {
      const failure = staffFailure(error, 'That code no longer exists.');
      return { ok: false, error: failure.ok ? 'Something went wrong.' : failure.error };
    }
  },
};
