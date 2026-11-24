import { schema, withAccount } from '@ad/db';
import { Forbidden, isStaffRole, NotFound, roleAtLeast } from '@ad/shared';
import { eq } from 'drizzle-orm';
import { AccountService } from './accounts';
import { MfaCore } from './mfa-core';
import { readPendingMfa } from './mfa-pending';
import {
  AccountUnavailable,
  FieldErrors,
  InvalidCredentials,
  type Actor,
  type RequestMeta,
} from './types';

export interface ViewerMfaStatus {
  enabled: boolean;
  recoveryRemaining: number;
  /** Two or fewer codes left (M49-S03 AC2). */
  low: boolean;
}

export type ViewerMfaSignIn =
  | { status: 'signed_in'; accountId: string; session: { token: string; id: string } }
  | {
      status: 'pending_deletion';
      accountId: string;
      purgeAfter: Date;
      session: { token: string; id: string };
    };

const LOW_CODES = 2;

/** Optional authenticator app verification for viewers (module M49, stories S01 to S04). */
export class ViewerMfaService extends AccountService {
  private mfaCore?: MfaCore;
  private get mfa(): MfaCore {
    this.mfaCore ??= new MfaCore({
      db: this.deps.db,
      keys: this.deps.keys,
      lockouts: this.deps.lockouts,
      pepper: this.deps.pepper,
      now: () => this.now(),
    });
    return this.mfaCore;
  }

  private hook(accountId: string, meta: RequestMeta, field = 'code', signIn = false) {
    return {
      field,
      onFailure: async () => {
        await this.audit('viewer.mfa_failed', 'failure', meta, { accountId, role: 'viewer' });
        if (signIn) await this.recordLogin(accountId, 'viewer', 'mfa_failed', meta);
      },
    };
  }

  /** Staff have their own mandatory flow, so this service only serves viewer accounts. */
  private async viewerAccount(actor: Actor) {
    const account = await this.loadOwn(actor.accountId);
    if (!account || account.status !== 'active') throw new AccountUnavailable();
    if (isStaffRole(account.role)) throw new Forbidden();
    return account;
  }

  private async mailTo(accountId: string, send: (to: string) => Promise<unknown>): Promise<void> {
    this.run(async () => {
      const account = await this.loadOwn(accountId);
      if (!account?.emailEnc) return;
      await send(await this.deps.keys.open(accountId, 'email', account.emailEnc));
    });
  }

  async status(actor: Actor): Promise<ViewerMfaStatus> {
    const account = await this.viewerAccount(actor);
    const enabled = await this.mfa.isConfirmed(account.id);
    const recoveryRemaining = enabled ? await this.mfa.unusedRecoveryCount(account.id) : 0;
    return { enabled, recoveryRemaining, low: enabled && recoveryRemaining <= LOW_CODES };
  }

  /** M49-S01 AC1: a QR code and a manual key. Nothing is on until a valid code is confirmed. */
  async beginEnrolment(
    actor: Actor,
    _meta: RequestMeta,
  ): Promise<{ secret: string; uri: string; qrSvg: string }> {
    const account = await this.viewerAccount(actor);
    if (await this.mfa.isConfirmed(account.id)) {
      throw new FieldErrors({ code: 'Two step verification is already on' });
    }
    const email = await this.deps.keys.open(account.id, 'email', account.emailEnc!);
    return this.mfa.beginEnrolment(account.id, this.cfg.issuerName, email);
  }

  async confirmEnrolment(
    actor: Actor,
    input: { code: string },
    meta: RequestMeta,
  ): Promise<{ recoveryCodes: string[] }> {
    const account = await this.viewerAccount(actor);
    if (await this.mfa.isConfirmed(account.id)) {
      throw new FieldErrors({ code: 'Two step verification is already on' });
    }
    await this.mfa.verifyCode(account.id, input.code, {
      ...this.hook(account.id, meta),
      requireConfirmed: false,
    });
    await this.mfa.confirm(account.id);
    const recoveryCodes = await this.mfa.replaceRecoveryCodes(account.id);
    await this.audit('viewer.mfa_enrolled', 'success', meta, {
      accountId: account.id,
      role: account.role,
    });
    await this.mailTo(account.id, (to) => this.deps.mailer.sendMfaEnabled({ to }));
    return { recoveryCodes };
  }

  /** Reads the pending note from the first sign in step. Every problem looks the same. */
  private pending(token: string): string {
    const read = readPendingMfa(this.deps.pepper, token, this.now().getTime());
    if (!read) throw new InvalidCredentials();
    return read.accountId;
  }

  private async openSession(accountId: string, meta: RequestMeta): Promise<ViewerMfaSignIn> {
    const account = await this.loadOwn(accountId);
    if (
      !account ||
      isStaffRole(account.role) ||
      (account.status !== 'active' && account.status !== 'pending_deletion')
    ) {
      throw new InvalidCredentials();
    }
    const now = this.now();
    await withAccount(this.deps.db, { accountId, role: account.role }, (tx) =>
      tx.update(schema.accounts).set({ lastLoginAt: now }).where(eq(schema.accounts.id, accountId)),
    );
    const session = await this.deps.sessions.create({
      accountId,
      kind: 'viewer',
      ipTrunc: meta.ipTrunc,
      userAgent: meta.userAgent,
      ...this.sessionExtras(meta),
    });
    await this.recordLogin(accountId, account.role, 'success', meta, {
      sessionId: session.session.id,
    });
    await this.audit('auth.login', 'success', meta, { accountId, role: account.role });
    const handle = { token: session.token, id: session.session.id };
    if (account.status === 'pending_deletion') {
      const [pending] = await this.deps.db
        .select({ purgeAfter: schema.accountDeletions.purgeAfter })
        .from(schema.accountDeletions)
        .where(eq(schema.accountDeletions.accountId, accountId));
      return {
        status: 'pending_deletion',
        accountId,
        purgeAfter: pending?.purgeAfter ?? now,
        session: handle,
      };
    }
    return { status: 'signed_in', accountId, session: handle };
  }

  /** M49-S02: the second step after a correct password (or Google sign in). */
  async completeSignIn(
    pendingToken: string,
    input: { code: string },
    meta: RequestMeta,
  ): Promise<ViewerMfaSignIn> {
    const accountId = this.pending(pendingToken);
    await this.mfa.verifyCode(accountId, input.code, {
      ...this.hook(accountId, meta, 'code', true),
      requireConfirmed: true,
    });
    return this.openSession(accountId, meta);
  }

  /** M49-S03 AC1: a recovery code signs in once. Mails the owner, and warns once when two are left. */
  async completeRecovery(
    pendingToken: string,
    input: { code: string },
    meta: RequestMeta,
  ): Promise<ViewerMfaSignIn & { remaining: number }> {
    const accountId = this.pending(pendingToken);
    const { remaining } = await this.mfa.claimRecoveryCode(
      accountId,
      input.code,
      this.hook(accountId, meta, 'code', true),
    );
    const opened = await this.openSession(accountId, meta);
    await this.audit('viewer.recovery_used', 'success', meta, { accountId, role: 'viewer' });
    await this.mailTo(accountId, async (to) => {
      await this.deps.mailer.sendRecoveryCodeUsed({ to, remaining });
      if (remaining === LOW_CODES) await this.deps.mailer.sendRecoveryCodesLow({ to, remaining });
    });
    return { ...opened, remaining };
  }

  /** M49-S03 AC3: new codes after the password is confirmed. Every old code stops working. */
  async regenerateRecoveryCodes(
    actor: Actor,
    input: { password: string },
    meta: RequestMeta,
  ): Promise<string[]> {
    const account = await this.viewerAccount(actor);
    if (!(await this.mfa.isConfirmed(account.id))) throw new NotFound();
    await this.confirmPassword(actor, input.password, meta, 'password', 'Password is not right');
    const codes = await this.mfa.replaceRecoveryCodes(account.id);
    await this.audit('viewer.recovery_regenerated', 'success', meta, {
      accountId: account.id,
      role: account.role,
    });
    return codes;
  }

  /** M49-S04 AC1: password and a current code (or a recovery code). Other sessions end. */
  async disable(
    actor: Actor,
    input: { password: string; code: string },
    meta: RequestMeta,
  ): Promise<void> {
    const account = await this.viewerAccount(actor);
    if (!(await this.mfa.isConfirmed(account.id))) throw new NotFound();
    await this.confirmPassword(actor, input.password, meta, 'password', 'Password is not right');
    const hook = this.hook(account.id, meta);
    const looksLikeTotp = /^\d{6}$/.test(input.code.trim());
    if (looksLikeTotp) {
      await this.mfa.verifyCode(account.id, input.code.trim(), { ...hook, requireConfirmed: true });
    } else {
      await this.mfa.claimRecoveryCode(account.id, input.code, hook);
    }
    await this.mfa.removeAll(account.id);
    await this.deps.sessions.revokeAll(account.id, { exceptSessionId: actor.sessionId });
    await this.audit('viewer.mfa_disabled', 'success', meta, {
      accountId: account.id,
      role: account.role,
    });
    await this.mailTo(account.id, (to) => this.deps.mailer.sendMfaDisabled({ to }));
  }

  /** M49-S04 AC2 and AC3: an Admin clears the second step for someone who lost both phone and codes. */
  async adminReset(
    actor: Actor,
    input: { accountId: string; reason: string },
    meta: RequestMeta,
  ): Promise<void> {
    const admin = await this.loadOwn(actor.accountId);
    if (
      !admin ||
      admin.status !== 'active' ||
      !isStaffRole(admin.role) ||
      !roleAtLeast(admin.role, 'admin')
    ) {
      throw new Forbidden();
    }
    const reason = input.reason.trim();
    if (reason.length < 3) throw new FieldErrors({ reason: 'Say why you are resetting this' });
    if (reason.length > 300) throw new FieldErrors({ reason: 'Use 300 characters or fewer' });
    const target = await this.loadOwn(input.accountId);
    if (!target || isStaffRole(target.role)) throw new NotFound();
    await this.mfa.removeAll(target.id);
    await this.deps.sessions.revokeAll(target.id);
    await this.deps.audit.record({
      action: 'viewer.mfa_reset_by_admin',
      outcome: 'success',
      actorAccountId: admin.id,
      actorRole: admin.role,
      targetType: 'account',
      targetId: target.id,
      ipTrunc: meta.ipTrunc,
      requestId: meta.requestId,
      metadata: { reason },
    });
    await this.mailTo(target.id, (to) => this.deps.mailer.sendViewerTwoFactorReset({ to }));
  }
}
