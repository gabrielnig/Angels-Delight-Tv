import 'server-only';
import { writeAudit } from '@ad/audit';
import { FieldErrors } from '@ad/auth';
import { schema, withAccount } from '@ad/db';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { adminRuntime, titleCaseFromEmail } from '@/server/admin/runtime';
import { deviceLabel } from '@/server/auth/devices';
import type { AccountService } from '../services';
import type { FieldResult } from '../account-commands';
import type { MyAccount } from '../types';
import { catalogActor, need } from './shared';
import { staffFailure } from './staff-errors';

const OK: FieldResult = { ok: true };
const fail = (field: string, error: string): FieldResult => ({ ok: false, field, error });
const DISPLAY_NAME = 'display_name';
/** The auth service names its fields after its own forms. The screen uses shorter names. */
const FIELD: Record<string, string> = { currentPassword: 'current', newPassword: 'next' };

function staffActor(actor: { accountId: string; role: string; sessionId?: string }) {
  if (!actor.sessionId) throw new Error('This action needs a signed in staff session');
  return {
    accountId: actor.accountId,
    role: actor.role as 'editor' | 'admin' | 'super_admin',
    sessionId: actor.sessionId,
  };
}

/** Maps what the staff service throws onto the field the screen shows the message under. */
function fieldFailure(error: unknown, fallback: string): FieldResult {
  if (error instanceof FieldErrors) {
    const [key, message] = Object.entries(error.fields)[0] ?? [fallback, 'Check the details.'];
    return fail(FIELD[key] ?? key, message);
  }
  const result = staffFailure(error);
  return fail(fallback, result.ok ? 'Something went wrong.' : result.error);
}

export const realAccountService: AccountService = {
  async get(actor) {
    need(actor, 'account.own');
    const rt = adminRuntime();
    const { staff, sessions, keys } = rt.auth();
    const who = staffActor(actor);
    const overview = await staff.getOverview(who);
    const own = catalogActor(actor);
    const [row] = await withAccount(rt.db(), own, (tx) =>
      tx
        .select({
          displayNameEnc: schema.accounts.displayNameEnc,
          passwordChangedAt: schema.accounts.passwordChangedAt,
        })
        .from(schema.accounts)
        .where(eq(schema.accounts.id, actor.accountId)),
    );
    let name = titleCaseFromEmail(overview.email);
    if (row?.displayNameEnc) {
      try {
        name = await keys.open(actor.accountId, DISPLAY_NAME, new Uint8Array(row.displayNameEnc));
      } catch {
        // An unreadable name falls back to the one from the address.
      }
    }
    const [codes] = await rt
      .db()
      .select({ left: sql<number>`count(*)::int` })
      .from(schema.mfaRecoveryCodes)
      .where(
        and(
          eq(schema.mfaRecoveryCodes.accountId, actor.accountId),
          isNull(schema.mfaRecoveryCodes.usedAt),
        ),
      );
    const live = await sessions.list(actor.accountId);
    const step = await staff.secondStep(who);
    const trusted = await staff.listTrustedDevices(who);
    const account: MyAccount = {
      accountId: actor.accountId,
      name,
      email: overview.email,
      twoFactor: step === 'authenticator',
      secondStep: step === 'email' ? 'email' : 'authenticator',
      security: await staff.securitySummary(who),
      trustedDevices: trusted.map((d) => ({
        id: d.id,
        label: d.label,
        place: d.country ?? 'Unknown location',
        lastUsedAt: d.lastUsedAt ? d.lastUsedAt.toISOString() : null,
        expiresAt: d.expiresAt.toISOString(),
      })),
      recoveryCodesLeft: codes?.left ?? 0,
      passwordChangedAt: row?.passwordChangedAt ? row.passwordChangedAt.toISOString() : null,
      sessions: live.map((s) => ({
        id: s.id,
        device: deviceLabel(s.userAgent),
        place: s.ipTrunc ?? 'Unknown location',
        lastActiveAt: s.lastSeenAt.toISOString(),
        current: s.id === actor.sessionId,
      })),
    };
    return account;
  },

  async updateName(actor, raw) {
    need(actor, 'account.own');
    const name = raw.trim().replace(/\s+/g, ' ');
    if (name.length < 2) return fail('name', 'Use at least 2 characters.');
    if (name.length > 60) return fail('name', 'Use 60 characters or fewer.');
    const rt = adminRuntime();
    const sealed = await rt.auth().keys.seal(actor.accountId, DISPLAY_NAME, name);
    await withAccount(rt.db(), catalogActor(actor), async (tx) => {
      await tx
        .update(schema.accounts)
        .set({ displayNameEnc: sealed })
        .where(eq(schema.accounts.id, actor.accountId));
      await writeAudit(tx, {
        action: 'account.update',
        outcome: 'success',
        actorAccountId: actor.accountId,
        actorRole: actor.role,
        targetType: 'account',
        targetId: actor.accountId,
        summary: 'Changed their display name',
      });
    });
    return OK;
  },

  async changePassword(actor, current, next, confirm, code) {
    need(actor, 'account.own');
    if (next !== confirm) return fail('confirm', 'The two passwords do not match.');
    try {
      const rt = adminRuntime();
      const result = await rt
        .auth()
        .staff.changeStaffPassword(
          staffActor(actor),
          { currentPassword: current, newPassword: next, code },
          await rt.meta(),
        );
      // Other devices were signed out and this one got a new session, so the cookie must follow.
      await rt.setSession(result.session.token);
      return OK;
    } catch (error) {
      return fieldFailure(error, 'current');
    }
  },

  async revokeSession(actor, sessionId) {
    need(actor, 'account.own');
    if (sessionId === actor.sessionId)
      return fail('session', 'This is the device you are using. Sign out from the menu instead.');
    const rt = adminRuntime();
    const done = await rt.auth().sessions.revokeOwn(actor.accountId, sessionId);
    return done ? OK : fail('session', 'That session is already gone.');
  },

  async regenerateCodes(actor, code) {
    need(actor, 'account.own');
    try {
      const rt = adminRuntime();
      const codes = await rt
        .auth()
        .staff.regenerateRecoveryCodes(staffActor(actor), { code }, await rt.meta());
      return { ok: true, codes };
    } catch (error) {
      const failed = fieldFailure(error, 'code');
      return failed.ok
        ? { ok: false, field: 'code', error: 'Something went wrong.' }
        : { ok: false, field: failed.field, error: failed.error };
    }
  },

  async sendConfirmCode(actor) {
    need(actor, 'account.own');
    try {
      const rt = adminRuntime();
      const result = await rt.auth().staff.sendConfirmCode(staffActor(actor), await rt.meta());
      return result.sent
        ? OK
        : fail('code', 'We could not send the code. Try again in a moment.');
    } catch (error) {
      return fieldFailure(error, 'code');
    }
  },

  async revokeTrustedDevice(actor, id) {
    need(actor, 'account.own');
    try {
      const rt = adminRuntime();
      await rt.auth().staff.revokeTrustedDevice(staffActor(actor), id, await rt.meta());
      return OK;
    } catch (error) {
      return fieldFailure(error, 'device');
    }
  },

  async sendTestCode(actor) {
    need(actor, 'account.own');
    try {
      const rt = adminRuntime();
      const result = await rt.auth().staff.sendTestCode(staffActor(actor), await rt.meta());
      return result.sent ? OK : fail('code', 'We could not send the code. Try again in a moment.');
    } catch (error) {
      return fieldFailure(error, 'code');
    }
  },

  async confirmTestCode(actor, code) {
    need(actor, 'account.own');
    try {
      const rt = adminRuntime();
      await rt.auth().staff.confirmTestCode(staffActor(actor), { code }, await rt.meta());
      return OK;
    } catch (error) {
      return fieldFailure(error, 'code');
    }
  },

  async switchToEmail(actor, input) {
    need(actor, 'account.own');
    try {
      const rt = adminRuntime();
      await rt.auth().staff.switchToEmailCodes(staffActor(actor), input, await rt.meta());
      return OK;
    } catch (error) {
      return fieldFailure(error, 'code');
    }
  },

  async beginAuthenticator(actor, password) {
    need(actor, 'account.own');
    try {
      const rt = adminRuntime();
      const begin = await rt.auth().staff.beginAuthenticatorSwitch(staffActor(actor), { password }, await rt.meta());
      return { ok: true, secret: begin.secret, qrSvg: begin.qrSvg };
    } catch (error) {
      const failed = fieldFailure(error, 'password');
      return failed.ok ? { ok: false, field: 'password', error: 'Something went wrong.' } : failed;
    }
  },

  async finishAuthenticator(actor, code) {
    need(actor, 'account.own');
    try {
      const rt = adminRuntime();
      const done = await rt.auth().staff.finishAuthenticatorSwitch(staffActor(actor), { code }, await rt.meta());
      return { ok: true, codes: done.recoveryCodes };
    } catch (error) {
      const failed = fieldFailure(error, 'code');
      return failed.ok ? { ok: false, field: 'code', error: 'Something went wrong.' } : failed;
    }
  },
};
