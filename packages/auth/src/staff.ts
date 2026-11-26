import { schema, withAccount } from '@ad/db';
import { LOCKOUT_POLICIES, RATE_POLICIES } from '@ad/security';
import {
  ACCOUNT_ROLES,
  Conflict,
  decryptAesGcm,
  encryptAesGcm,
  Forbidden,
  NotFound,
  RateLimited,
  uuidv7,
  isStaffRole as isStaffRoleName,
  roleAtLeast,
  type AccountRole,
} from '@ad/shared';
import { and, desc, eq, inArray, isNull, ne, sql } from 'drizzle-orm';
import { AccountService, formatDate } from './accounts';
import { emailHash, maskEmail, normalizeEmail } from './identifiers';
import { findAccountByEmailHash, isUniqueViolation } from './lookup';
import { countryName, deviceLabel } from './login-events';
import { MfaCore } from './mfa-core';
import {
  checkStaffCode,
  codeMailContext,
  sendStaffCode,
  type StaffCodeContext,
  type StaffCodePurpose,
} from './staff-email-code';
import {
  generateInviteCode,
  inviteCodeHash,
  inviteStatus,
  type SignupInviteStatus,
} from './signup-invites';
import { generateToken, hashToken } from './tokens';
import { TrustedDevices, type TrustedDeviceView } from './trusted-devices';
import {
  FieldErrors,
  InvalidCredentials,
  ReauthRequired,
  TokenRejected,
  type Actor,
  type RequestMeta,
} from './types';

type StaffRole = 'editor' | 'admin' | 'super_admin';
const isStaffRole = (role: string): role is StaffRole => isStaffRoleName(role);

const STEP_STATUS = {
  authenticator: 'mfa_required',
  email: 'email_code_required',
  enrol: 'enrol_required',
} as const;

const enc = new TextEncoder();
const dec = new TextDecoder();

/** Which second step a staff member meets after a correct password (D-397). */
/** What the Security section of My account shows (L16b). */
export interface SecuritySummary {
  method: 'authenticator' | 'email';
  /** Emailed codes can be used now: mail is on, the site allows it and the address is verified. */
  canUseEmail: boolean;
  /** Plain words for why not, when canUseEmail is false. */
  blocker?: string;
  /** A test code worked in the last 15 minutes. */
  testedRecently: boolean;
}

export type SecondStep = 'authenticator' | 'email' | 'enrol';

export interface StaffSignIn {
  status: 'enrol_required' | 'mfa_required' | 'email_code_required' | 'signed_in';
  /** For `email_code_required`: false when the mail could not be sent and the person must ask again. */
  codeSent?: boolean;
  accountId: string;
  session: { token: string; id: string };
}

export interface InviteSummary {
  id: string;
  email: string;
  role: StaffRole;
  expiresAt: Date;
  createdAt: Date;
}

export interface SignupInviteSummary {
  id: string;
  label: string;
  hint: string;
  uses: number;
  maxUses: number;
  expiresAt: Date | null;
  createdAt: Date;
  status: SignupInviteStatus;
}

export interface StaffMember {
  accountId: string;
  email: string;
  role: StaffRole;
  lastLoginAt: Date | null;
  twoFactor: boolean;
}

function pgCode(error: unknown): string | undefined {
  let current: unknown = error;
  for (let depth = 0; depth < 4 && current; depth++) {
    const code = (current as { code?: unknown }).code;
    if (typeof code === 'string' && code.length === 5) return code;
    current = (current as { cause?: unknown }).cause;
  }
  return undefined;
}

/** Staff sign in with a second factor, invitations and role management (module M12). */
export class StaffService extends AccountService {
  // ---------------------------------------------------------------------------------------------
  // Guards
  // ---------------------------------------------------------------------------------------------

  /** Reads the role from the database, not from the caller, so a stale or forged Actor gains nothing. */
  private async staffAccount(actor: Actor, minimum: StaffRole = 'editor') {
    const account = await this.loadOwn(actor.accountId);
    if (!account || account.status !== 'active' || !isStaffRole(account.role))
      throw new Forbidden();
    if (!roleAtLeast(account.role, minimum)) throw new Forbidden();
    return { ...account, role: account.role as StaffRole };
  }

  /** Sensitive actions need the password confirmed within the last ten minutes (SECURITY.md section 4). */
  async assertRecentReauth(actor: Actor): Promise<void> {
    const [session] = await this.deps.db
      .select({ reauthAt: schema.sessions.reauthAt })
      .from(schema.sessions)
      .where(and(eq(schema.sessions.id, actor.sessionId), isNull(schema.sessions.revokedAt)));
    const limit = this.now().getTime() - this.cfg.reauthWindowSeconds * 1000;
    if (!session?.reauthAt || session.reauthAt.getTime() < limit) throw new ReauthRequired();
  }

  // ---------------------------------------------------------------------------------------------
  // Admin sign in
  // ---------------------------------------------------------------------------------------------

  private adminKey(hash: Uint8Array): string {
    return `admin:${Buffer.from(hash).toString('hex')}`;
  }

  async adminSignIn(
    input: { email: string; password: string },
    meta: RequestMeta,
  ): Promise<StaffSignIn> {
    const email = normalizeEmail(input.email);
    const hash = email ? emailHash(email, this.deps.pepper) : null;
    const ipKey = this.ipSubject(meta);

    const ip = await this.closed(() => this.deps.limiter.peek(RATE_POLICIES.loginIp, ipKey));
    if (!ip.allowed) throw new RateLimited(ip.retryAfterSeconds);
    if (hash) {
      const lock = await this.closed(() => this.deps.lockouts.status(this.adminKey(hash)));
      if (lock.locked) {
        await this.audit('admin.login', 'denied', meta, { metadata: { reason: 'locked' } });
        throw new RateLimited(lock.retryAfterSeconds);
      }
    }

    const account = hash ? await findAccountByEmailHash(this.deps.db, hash) : null;
    let verified = false;
    if (account?.passwordHash)
      verified = await this.deps.hasher.verify(account.passwordHash, input.password);
    else await this.deps.hasher.verifyDummy(input.password);
    const allowed = Boolean(
      account && verified && account.status === 'active' && isStaffRole(account.role),
    );

    if (!allowed || !account || !hash || !email) {
      await this.closed(() => this.deps.limiter.consume(RATE_POLICIES.loginIp, ipKey));
      await this.audit('admin.login', 'failure', meta, { accountId: account?.id ?? null });
      if (hash) await this.registerStaffFailure(hash, account?.id ?? null, email ?? '', meta);
      throw new InvalidCredentials();
    }

    await this.closed(() => this.deps.lockouts.clear(this.adminKey(hash)));
    const now = this.now();
    await withAccount(this.deps.db, { accountId: account.id, role: account.role }, (tx) =>
      tx
        .update(schema.accounts)
        .set({ lastLoginAt: now })
        .where(eq(schema.accounts.id, account.id)),
    );
    const sessionInput = {
      accountId: account.id,
      ipTrunc: meta.ipTrunc,
      userAgent: meta.userAgent,
    };
    if (this.cfg.devSkipMfa) {
      const session = await this.deps.sessions.create({ ...sessionInput, kind: 'staff' });
      await this.audit('admin.login', 'success', meta, {
        accountId: account.id,
        role: account.role,
        metadata: { mfa: 'skipped' },
      });
      return {
        status: 'signed_in',
        accountId: account.id,
        session: { token: session.token, id: session.session.id },
      };
    }
    const step = await this.secondStepFor(account.id);
    if (step === 'email' && (await this.trustedDays()) > 0) {
      const known = await this.trusted.recognise(account.id, meta.trustedDeviceToken);
      if (known) {
        const session = await this.deps.sessions.create({ ...sessionInput, kind: 'staff' });
        await this.deps.sessions.markReauth(session.session.id);
        await this.audit('admin.login', 'success', meta, {
          accountId: account.id,
          role: account.role,
          metadata: { mfa: 'trusted_device', deviceId: known },
        });
        return {
          status: 'signed_in',
          accountId: account.id,
          session: { token: session.token, id: session.session.id },
        };
      }
    }
    const session = await this.deps.sessions.create({ ...sessionInput, kind: 'pending_mfa' });
    await this.audit('admin.login_password', 'success', meta, {
      accountId: account.id,
      role: account.role,
    });
    const codeSent =
      step === 'email'
        ? (await this.mailCode(account.id, account.role, 'staff_sign_in', meta, 'reuse')).sent
        : undefined;
    return {
      status: STEP_STATUS[step],
      ...(codeSent === undefined ? {} : { codeSent }),
      accountId: account.id,
      session: { token: session.token, id: session.session.id },
    };
  }

  protected override passwordLockKey(hash: Uint8Array, role: string): string {
    return isStaffRole(role) ? this.adminKey(hash) : super.passwordLockKey(hash, role);
  }

  protected override registerPasswordFailure(
    hash: Uint8Array,
    accountId: string,
    role: string,
    email: string,
    meta: RequestMeta,
    policy: Parameters<AccountService['registerPasswordFailure']>[5],
  ): Promise<void> {
    return isStaffRole(role)
      ? this.registerStaffFailure(hash, accountId, email, meta)
      : super.registerPasswordFailure(hash, accountId, role, email, meta, policy);
  }

  protected override async clearPasswordLocks(hash: Uint8Array, role: string): Promise<void> {
    await super.clearPasswordLocks(hash, role);
    if (isStaffRole(role)) await this.closed(() => this.deps.lockouts.clear(this.adminKey(hash)));
  }

  private async registerStaffFailure(
    hash: Uint8Array,
    accountId: string | null,
    email: string,
    meta: RequestMeta,
  ): Promise<void> {
    const policy = LOCKOUT_POLICIES.adminLogin;
    const state = await this.closed(() =>
      this.deps.lockouts.registerFailure(this.adminKey(hash), policy),
    );
    if (!state.justLocked) return;
    await this.audit('admin.lockout', 'denied', meta, {
      accountId,
      metadata: { minutes: policy.lockSeconds / 60 },
    });
    if (!accountId) return;
    this.run(async () => {
      const allowed = await this.deps.limiter.consume(
        RATE_POLICIES.lockoutNoticeAccount,
        this.subject('staff', accountId),
      );
      if (!allowed.allowed) return;
      const admins = await withAccount(this.deps.db, { accountId, role: 'admin' }, (tx) =>
        tx
          .select({ id: schema.accounts.id, emailEnc: schema.accounts.emailEnc })
          .from(schema.accounts)
          .where(
            and(
              inArray(schema.accounts.role, ['admin', 'super_admin']),
              eq(schema.accounts.status, 'active'),
            ),
          ),
      );
      for (const admin of admins) {
        if (!admin.emailEnc) continue;
        const to = await this.deps.keys.open(admin.id, 'email', admin.emailEnc);
        await this.deps.mailer.sendStaffLockoutAlert({
          to,
          account: maskEmail(email),
          minutes: policy.lockSeconds / 60,
        });
      }
    });
  }

  // ---------------------------------------------------------------------------------------------
  // Second factor
  // ---------------------------------------------------------------------------------------------

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

  private mfaFailed(accountId: string, role: string, meta: RequestMeta) {
    return {
      onFailure: () => this.audit('admin.mfa_failed', 'failure', meta, { accountId, role }),
    };
  }

  /** Checks an authenticator code, with lockout, one step of drift and replay protection. */
  private checkTotp(
    accountId: string,
    role: string,
    code: string,
    meta: RequestMeta,
    options: { requireConfirmed: boolean },
  ): Promise<{ factorId: string; step: number }> {
    return this.mfa.verifyCode(accountId, code, {
      ...this.mfaFailed(accountId, role, meta),
      requireConfirmed: options.requireConfirmed,
    });
  }

  /**
   * An enrolled authenticator always wins. Otherwise the site setting decides: an emailed code (when mail is on)
   * or enrolment. The result is never "no second step" (D-397).
   */
  private async secondStepFor(accountId: string): Promise<SecondStep> {
    if (await this.mfa.isConfirmed(accountId)) return 'authenticator';
    const policy = (await this.deps.secondStepPolicy?.()) ?? 'authenticator';
    const mailOn = this.deps.emailAvailable?.() ?? true;
    return policy === 'email' && mailOn ? 'email' : 'enrol';
  }

  /** Whether emailed codes can be offered right now: the site setting is email and mail is on. */
  async emailStepAvailable(): Promise<boolean> {
    const policy = (await this.deps.secondStepPolicy?.()) ?? 'authenticator';
    return policy === 'email' && (this.deps.emailAvailable?.() ?? true);
  }

  /** The second step the signed in or waiting session of this account faces now. */
  async secondStep(actor: Actor): Promise<SecondStep> {
    const account = await this.staffAccount(actor);
    return this.secondStepFor(account.id);
  }

  private async sessionIsPending(actor: Actor): Promise<boolean> {
    const [session] = await this.deps.db
      .select({ mfaVerifiedAt: schema.sessions.mfaVerifiedAt })
      .from(schema.sessions)
      .where(and(eq(schema.sessions.id, actor.sessionId), isNull(schema.sessions.revokedAt)));
    return !session || session.mfaVerifiedAt === null;
  }

  private codeContext(to: string, purpose: StaffCodePurpose): StaffCodeContext {
    return {
      db: this.deps.db,
      limiter: this.deps.limiter,
      pepper: this.deps.pepper,
      cfg: this.cfg,
      now: () => this.now(),
      subject: (kind, value) => this.subject(kind, value),
      send: (mail) =>
        purpose === 'staff_sign_in'
          ? this.deps.mailer.sendStaffSignInCode({ to, ...mail })
          : this.deps.mailer.sendStaffConfirmCode({ to, ...mail }),
    };
  }

  /** Mails a code in the request (D-024) and audits it. A failed send is audited, not hidden. */
  private async mailCode(
    accountId: string,
    role: string,
    purpose: StaffCodePurpose,
    meta: RequestMeta,
    whenWaiting: 'reuse' | 'throw' = 'throw',
  ): Promise<{ sent: boolean }> {
    const account = await this.loadOwn(accountId);
    if (!account?.emailEnc) throw new Forbidden();
    const to = await this.deps.keys.open(accountId, 'email', account.emailEnc);
    const result = await sendStaffCode(this.codeContext(to, purpose), {
      accountId,
      purpose,
      meta,
      whenWaiting,
    });
    const kind = purpose === 'staff_sign_in' ? 'sign_in' : 'confirm';
    await this.audit(
      result.sent ? 'admin.email_code_sent' : 'admin.email_code_send_failed',
      result.sent ? 'success' : 'failure',
      meta,
      { accountId, role, metadata: { kind } },
    );
    return result;
  }

  private async checkEmailCode(
    account: { id: string; role: string },
    purpose: StaffCodePurpose,
    code: string,
    meta: RequestMeta,
  ): Promise<void> {
    await this.mfa.lockCheck(account.id);
    const result = await checkStaffCode(this.codeContext('', purpose), {
      accountId: account.id,
      purpose,
      code: code.replace(/\s/g, ''),
    });
    if (result === 'ok') {
      await this.mfa.clearFailures(account.id);
      return;
    }
    const message =
      result === 'expired'
        ? 'That code has expired'
        : result === 'too_many'
          ? 'Too many wrong tries on that code'
          : 'That code is not right';
    return this.mfa.failWrongCode(account.id, {
      onFailure: () =>
        this.audit('admin.email_code_failed', 'failure', meta, {
          accountId: account.id,
          role: account.role,
          metadata: { reason: result },
        }),
      message,
    });
  }

  /** Sends the sign in code again. Only a session still waiting for its second step, only for email accounts. */
  async sendSignInCode(actor: Actor, meta: RequestMeta): Promise<{ sent: boolean }> {
    const account = await this.staffAccount(actor);
    if (!(await this.sessionIsPending(actor))) throw new Forbidden();
    if ((await this.secondStepFor(account.id)) !== 'email') throw new Forbidden();
    return this.mailCode(account.id, account.role, 'staff_sign_in', meta);
  }

  private trustedStore?: TrustedDevices;
  private get trusted(): TrustedDevices {
    this.trustedStore ??= new TrustedDevices(this.deps.db, () => this.now());
    return this.trustedStore;
  }

  private async trustedDays(): Promise<number> {
    return (await this.deps.trustedDeviceDays?.()) ?? 30;
  }

  async listTrustedDevices(actor: Actor): Promise<TrustedDeviceView[]> {
    const account = await this.staffAccount(actor);
    return this.trusted.list(account.id);
  }

  async revokeTrustedDevice(actor: Actor, deviceId: string, meta: RequestMeta): Promise<void> {
    const account = await this.staffAccount(actor);
    if (!(await this.trusted.revoke(account.id, deviceId))) throw new NotFound();
    await this.audit('admin.trusted_device_revoked', 'success', meta, {
      accountId: account.id,
      role: account.role,
      metadata: { deviceId },
    });
  }

  async verifyEmailCode(
    actor: Actor,
    input: { code: string; remember?: boolean },
    meta: RequestMeta,
  ): Promise<{
    session: { token: string; id: string };
    /** Set when the person chose Remember this device and the site allows it. Goes in a cookie. */
    trustedDevice?: { token: string; maxAgeSeconds: number };
  }> {
    const account = await this.staffAccount(actor);
    if ((await this.secondStepFor(account.id)) !== 'email') throw new Forbidden();
    await this.checkEmailCode(account, 'staff_sign_in', input.code, meta);
    const session = await this.deps.sessions.promoteToStaff(actor.sessionId);
    await this.audit('admin.login', 'success', meta, {
      accountId: account.id,
      role: account.role,
      metadata: { mfa: 'email' },
    });
    const days = input.remember ? await this.trustedDays() : 0;
    const trustedDevice =
      days > 0
        ? await this.trusted.remember(account.id, {
            label: deviceLabel(meta.userAgent),
            country: meta.country ?? null,
            days,
          })
        : undefined;
    if (trustedDevice)
      await this.audit('admin.trusted_device_added', 'success', meta, {
        accountId: account.id,
        role: account.role,
        metadata: { country: countryName(meta.country ?? null), days },
      });
    return {
      session: { token: session.token, id: session.session.id },
      ...(trustedDevice ? { trustedDevice } : {}),
    };
  }

  /** Mails a code to confirm a sensitive action. Someone with an authenticator uses that instead. */
  async sendConfirmCode(actor: Actor, meta: RequestMeta): Promise<{ sent: boolean }> {
    const account = await this.staffAccount(actor);
    if (await this.sessionIsPending(actor)) throw new Forbidden();
    if (await this.mfa.isConfirmed(account.id))
      throw new Conflict('Your account uses an authenticator app. Use your password or the code from the app instead.');
    return this.mailCode(account.id, account.role, 'staff_confirm', meta);
  }

  /** Authenticator code when one is set up, otherwise a fresh emailed confirmation code. */
  private async checkSensitiveCode(
    account: { id: string; role: string },
    code: string,
    meta: RequestMeta,
  ): Promise<void> {
    if (await this.mfa.isConfirmed(account.id)) {
      await this.checkTotp(account.id, account.role, code, meta, { requireConfirmed: true });
      return;
    }
    await this.checkEmailCode(account, 'staff_confirm', code, meta);
  }

  /** Same as confirming the password, for staff without an authenticator: a fresh emailed code. */
  async reauthenticateWithEmailCode(
    actor: Actor,
    input: { code: string },
    meta: RequestMeta,
  ): Promise<void> {
    const account = await this.staffAccount(actor);
    if (await this.mfa.isConfirmed(account.id))
      throw new Conflict('Use your password or the code from your authenticator app');
    await this.checkEmailCode(account, 'staff_confirm', input.code, meta);
    await this.deps.sessions.markReauth(actor.sessionId);
  }

  /** A waiting session may enrol only when the site asks for an authenticator, never to bypass the email step. */
  private async assertMayEnrol(actor: Actor, accountId: string): Promise<void> {
    if ((await this.sessionIsPending(actor)) && (await this.secondStepFor(accountId)) !== 'enrol')
      throw new Forbidden();
  }

  /** Why this account cannot use emailed codes right now, in plain words, or null when it can (lockout guard). */
  private async emailBlocker(account: { emailVerifiedAt: Date | null }): Promise<string | null> {
    if (!(this.deps.emailAvailable?.() ?? true))
      return 'Email is not set up on this site yet, so codes cannot be sent. Ask your Super admin to set it up.';
    if (((await this.deps.secondStepPolicy?.()) ?? 'authenticator') !== 'email')
      return 'This site is set to authenticator apps. A Super admin can allow emailed codes in Site settings, Security.';
    if (!account.emailVerifiedAt) return 'Verify your email address first, then come back.';
    return null;
  }

  /** A test code worked in the last 15 minutes (the audit entry is the record, so no new table). */
  private async emailTestedRecently(accountId: string): Promise<boolean> {
    const [row] = await this.deps.db
      .select({ id: schema.auditLog.id })
      .from(schema.auditLog)
      .where(
        and(
          eq(schema.auditLog.actorAccountId, accountId),
          eq(schema.auditLog.action, 'admin.email_code_tested'),
          eq(schema.auditLog.outcome, 'success'),
          sql`${schema.auditLog.occurredAt} > now() - interval '15 minutes'`,
        ),
      )
      .limit(1);
    return Boolean(row);
  }

  /** What My account needs to draw the Security section: the method now and whether a switch to email is safe. */
  async securitySummary(actor: Actor): Promise<SecuritySummary> {
    const account = await this.staffAccount(actor);
    const method = (await this.mfa.isConfirmed(account.id)) ? 'authenticator' : 'email';
    const blocker = await this.emailBlocker(account);
    return {
      method,
      canUseEmail: blocker === null,
      ...(blocker ? { blocker } : {}),
      testedRecently: method === 'authenticator' ? await this.emailTestedRecently(account.id) : false,
    };
  }

  /** Mails a test code so the person can prove the inbox works before the authenticator is removed. */
  async sendTestCode(actor: Actor, meta: RequestMeta): Promise<{ sent: boolean }> {
    const account = await this.staffAccount(actor);
    if (await this.sessionIsPending(actor)) throw new Forbidden();
    const blocker = await this.emailBlocker(account);
    if (blocker) throw new Conflict(blocker);
    return this.mailCode(account.id, account.role, 'staff_confirm', meta);
  }

  /** Checks the test code. A right code is recorded, which unlocks the switch for 15 minutes. */
  async confirmTestCode(actor: Actor, input: { code: string }, meta: RequestMeta): Promise<void> {
    const account = await this.staffAccount(actor);
    if (await this.sessionIsPending(actor)) throw new Forbidden();
    await this.checkEmailCode(account, 'staff_confirm', input.code, meta);
    await this.audit('admin.email_code_tested', 'success', meta, {
      accountId: account.id,
      role: account.role,
    });
  }

  /** Tells the address that the second step method changed, with time and place, so a takeover is noticed. */
  private async noticeMethodChanged(
    account: { id: string; role: string; emailEnc: Uint8Array | null },
    method: 'email' | 'authenticator',
    meta: RequestMeta,
  ): Promise<void> {
    if (!account.emailEnc) return;
    const to = await this.deps.keys.open(account.id, 'email', account.emailEnc);
    const context = codeMailContext(meta, this.now());
    this.run(async () => {
      await this.deps.mailer.sendStaffSecondStepChanged({ to, method, ...context });
    });
  }

  /**
   * An authenticator user moves to emailed codes. Proof is either a fresh emailed code, or a fresh password plus the
   * current authenticator code after a test code worked. Mail must be on, the site on email and the address verified,
   * so nobody ends up with no second step. The authenticator and its recovery codes are removed, other sessions end.
   */
  async switchToEmailCodes(
    actor: Actor,
    input: { password?: string; code?: string; emailCode?: string },
    meta: RequestMeta,
  ): Promise<void> {
    const account = await this.staffAccount(actor);
    if (await this.sessionIsPending(actor)) throw new Forbidden();
    if (!(await this.mfa.isConfirmed(account.id))) throw new Conflict('You already use emailed codes');
    const blocker = await this.emailBlocker(account);
    if (blocker) throw new Conflict(blocker);
    let proof: 'email_code' | 'password_and_authenticator';
    if (input.emailCode) {
      await this.checkEmailCode(account, 'staff_confirm', input.emailCode, meta);
      await this.audit('admin.email_code_tested', 'success', meta, {
        accountId: account.id,
        role: account.role,
      });
      proof = 'email_code';
    } else {
      if (!(await this.emailTestedRecently(account.id)))
        throw new Conflict('Send yourself a test code first and enter it, so we know the email reaches you.');
      await this.reauthenticate(actor, input.password ?? '', meta);
      await this.checkTotp(account.id, account.role, input.code ?? '', meta, { requireConfirmed: true });
      proof = 'password_and_authenticator';
    }
    await this.mfa.removeAll(account.id);
    await this.deps.sessions.revokeAll(account.id, { exceptSessionId: actor.sessionId });
    await this.audit('admin.mfa_switched_to_email', 'success', meta, {
      accountId: account.id,
      role: account.role,
      metadata: { proof },
    });
    await this.noticeMethodChanged(account, 'email', meta);
  }

  /** Step one of moving back to an authenticator: a fresh password, then the secret and QR for the new app. */
  async beginAuthenticatorSwitch(
    actor: Actor,
    input: { password: string },
    meta: RequestMeta,
  ): Promise<{ secret: string; uri: string; qrSvg: string }> {
    const account = await this.staffAccount(actor);
    if (await this.sessionIsPending(actor)) throw new Forbidden();
    if (await this.mfa.isConfirmed(account.id)) throw new Conflict('You already use an authenticator app');
    await this.reauthenticate(actor, input.password, meta);
    const email = await this.deps.keys.open(account.id, 'email', account.emailEnc!);
    return this.mfa.beginEnrolment(account.id, this.cfg.issuerName, email);
  }

  /** Step two: a code from the new app turns it on, shows fresh recovery codes and ends the other sessions. */
  async finishAuthenticatorSwitch(
    actor: Actor,
    input: { code: string },
    meta: RequestMeta,
  ): Promise<{ recoveryCodes: string[] }> {
    const account = await this.staffAccount(actor);
    if (await this.sessionIsPending(actor)) throw new Forbidden();
    if (await this.mfa.isConfirmed(account.id)) throw new Conflict('You already use an authenticator app');
    await this.checkTotp(account.id, account.role, input.code, meta, { requireConfirmed: false });
    await this.mfa.confirm(account.id);
    const recoveryCodes = await this.mfa.replaceRecoveryCodes(account.id);
    await this.deps.sessions.revokeAll(account.id, { exceptSessionId: actor.sessionId });
    await this.trusted.revokeAll(account.id);
    await this.audit('admin.mfa_switched_to_authenticator', 'success', meta, {
      accountId: account.id,
      role: account.role,
    });
    await this.noticeMethodChanged(account, 'authenticator', meta);
    return { recoveryCodes };
  }

  /** True once the second factor was confirmed, so the sign in page knows whether to enrol or ask for a code. */
  async twoFactorConfirmed(actor: Actor): Promise<boolean> {
    const account = await this.staffAccount(actor);
    return this.mfa.isConfirmed(account.id);
  }

  async beginEnrolment(
    actor: Actor,
    _meta: RequestMeta,
  ): Promise<{ secret: string; uri: string; qrSvg: string }> {
    const account = await this.staffAccount(actor);
    if (await this.mfa.isConfirmed(account.id))
      throw new Conflict('Two factor sign in is already set up');
    await this.assertMayEnrol(actor, account.id);
    const email = await this.deps.keys.open(account.id, 'email', account.emailEnc!);
    return this.mfa.beginEnrolment(account.id, this.cfg.issuerName, email);
  }

  async confirmEnrolment(
    actor: Actor,
    input: { code: string },
    meta: RequestMeta,
  ): Promise<{ recoveryCodes: string[]; session: { token: string; id: string } }> {
    const account = await this.staffAccount(actor);
    await this.assertMayEnrol(actor, account.id);
    await this.checkTotp(account.id, account.role, input.code, meta, {
      requireConfirmed: false,
    });
    await this.mfa.confirm(account.id);
    const recoveryCodes = await this.mfa.replaceRecoveryCodes(account.id);
    await this.deps.sessions.revoke(actor.sessionId);
    const session = await this.deps.sessions.create({
      accountId: account.id,
      kind: 'staff',
      ipTrunc: meta.ipTrunc,
      userAgent: meta.userAgent,
    });
    await this.deps.sessions.markReauth(session.session.id);
    await this.audit('admin.mfa_enrolled', 'success', meta, {
      accountId: account.id,
      role: account.role,
    });
    return { recoveryCodes, session: { token: session.token, id: session.session.id } };
  }

  async verifyMfa(
    actor: Actor,
    input: { code: string },
    meta: RequestMeta,
  ): Promise<{ session: { token: string; id: string } }> {
    const account = await this.staffAccount(actor);
    await this.checkTotp(account.id, account.role, input.code, meta, { requireConfirmed: true });
    const session = await this.deps.sessions.promoteToStaff(actor.sessionId);
    await this.audit('admin.login', 'success', meta, {
      accountId: account.id,
      role: account.role,
      metadata: { mfa: 'totp' },
    });
    return { session: { token: session.token, id: session.session.id } };
  }

  async verifyRecoveryCode(
    actor: Actor,
    input: { code: string },
    meta: RequestMeta,
  ): Promise<{ remaining: number; session: { token: string; id: string } }> {
    const account = await this.staffAccount(actor);
    const { remaining } = await this.mfa.claimRecoveryCode(
      account.id,
      input.code,
      this.mfaFailed(account.id, account.role, meta),
    );
    const session = await this.deps.sessions.promoteToStaff(actor.sessionId);
    await this.audit('admin.login', 'success', meta, {
      accountId: account.id,
      role: account.role,
      metadata: { mfa: 'recovery' },
    });
    return { remaining, session: { token: session.token, id: session.session.id } };
  }

  async regenerateRecoveryCodes(
    actor: Actor,
    input: { code: string },
    meta: RequestMeta,
  ): Promise<string[]> {
    const account = await this.staffAccount(actor);
    if (!(await this.mfa.isConfirmed(account.id)))
      throw new Conflict('Recovery codes belong to an authenticator app. Set one up first.');
    await this.checkTotp(account.id, account.role, input.code, meta, { requireConfirmed: true });
    const codes = await this.mfa.replaceRecoveryCodes(account.id);
    await this.audit('admin.recovery_codes_regenerated', 'success', meta, {
      accountId: account.id,
      role: account.role,
    });
    return codes;
  }

  async changeStaffPassword(
    actor: Actor,
    input: { currentPassword: string; newPassword: string; code: string },
    meta: RequestMeta,
  ): Promise<{ session: { token: string; id: string } }> {
    const account = await this.staffAccount(actor);
    await this.checkSensitiveCode(account, input.code, meta);
    return this.changePassword(
      actor,
      { currentPassword: input.currentPassword, newPassword: input.newPassword },
      meta,
      'staff',
    );
  }

  /** M12-S03: an admin clears another person's authenticator after confirming with their own code. */
  async resetTwoFactor(
    actor: Actor,
    input: { accountId: string; code: string },
    meta: RequestMeta,
  ): Promise<void> {
    const admin = await this.staffAccount(actor, 'super_admin');
    if (input.accountId === admin.id)
      throw new Forbidden('Use a recovery code to reset your own two factor sign in');
    await this.checkSensitiveCode(admin, input.code, meta);
    const target = await withAccount(
      this.deps.db,
      { accountId: admin.id, role: admin.role },
      async (tx) => {
        const [row] = await tx
          .select({
            id: schema.accounts.id,
            emailEnc: schema.accounts.emailEnc,
            role: schema.accounts.role,
          })
          .from(schema.accounts)
          .where(eq(schema.accounts.id, input.accountId));
        return row;
      },
    );
    if (!target || !isStaffRole(target.role)) throw new NotFound();
    await this.mfa.removeAll(target.id);
    await this.deps.sessions.revokeAll(target.id);
    await this.deps.audit.record({
      action: 'admin.mfa_reset',
      outcome: 'success',
      actorAccountId: admin.id,
      actorRole: admin.role,
      targetType: 'account',
      targetId: target.id,
      ipTrunc: meta.ipTrunc,
      requestId: meta.requestId,
    });
    if (target.emailEnc) {
      const to = await this.deps.keys.open(target.id, 'email', target.emailEnc);
      this.run(() => this.deps.mailer.sendTwoFactorReset({ to }));
    }
  }

  // ---------------------------------------------------------------------------------------------
  // Invitations
  // ---------------------------------------------------------------------------------------------

  private openInviteEmail(id: string, sealed: Uint8Array): string {
    return dec.decode(
      decryptAesGcm(this.deps.kek, new Uint8Array(sealed), enc.encode(`invite:${id}`)),
    );
  }

  async createInvite(
    actor: Actor,
    input: { email: string; role: string },
    meta: RequestMeta,
  ): Promise<{ id: string; expiresAt: Date }> {
    const admin = await this.staffAccount(actor, 'super_admin');
    await this.assertRecentReauth(actor);
    const email = normalizeEmail(input.email);
    if (!email) throw new FieldErrors({ email: 'Enter a valid email address' });
    if (!isStaffRole(input.role))
      throw new FieldErrors({ role: 'Choose Editor, Admin or Super admin' });
    await this.deps.limiter.enforce(RATE_POLICIES.inviteSend, this.subject('invite', admin.id));

    const hash = emailHash(email, this.deps.pepper);
    const now = this.now();
    await this.deps.db
      .update(schema.adminInvites)
      .set({ revokedAt: now })
      .where(
        and(
          eq(schema.adminInvites.emailHash, Buffer.from(hash)),
          isNull(schema.adminInvites.acceptedAt),
          isNull(schema.adminInvites.revokedAt),
        ),
      );
    const id = uuidv7();
    const token = generateToken();
    const expiresAt = new Date(now.getTime() + this.cfg.inviteTtlSeconds * 1000);
    await this.deps.db.insert(schema.adminInvites).values({
      id,
      emailHash: Buffer.from(hash),
      emailEnc: Buffer.from(
        encryptAesGcm(this.deps.kek, enc.encode(email), enc.encode(`invite:${id}`)),
      ),
      role: input.role,
      tokenHash: Buffer.from(hashToken(token)),
      invitedBy: admin.id,
      expiresAt,
      createdAt: now,
    });
    await this.deps.mailer.sendAdminInvite({
      to: email,
      role: input.role,
      token,
      hours: Math.round(this.cfg.inviteTtlSeconds / 3600),
    });
    await this.audit('admin.invite_sent', 'success', meta, {
      accountId: admin.id,
      role: admin.role,
      metadata: { invitedRole: input.role },
    });
    return { id, expiresAt };
  }

  async listInvites(actor: Actor): Promise<InviteSummary[]> {
    await this.staffAccount(actor, 'super_admin');
    const rows = await this.deps.db
      .select()
      .from(schema.adminInvites)
      .where(and(isNull(schema.adminInvites.acceptedAt), isNull(schema.adminInvites.revokedAt)));
    return rows
      .map((row) => ({
        id: row.id,
        email: this.openInviteEmail(row.id, row.emailEnc),
        role: row.role as StaffRole,
        expiresAt: row.expiresAt,
        createdAt: row.createdAt,
      }))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async revokeInvite(actor: Actor, inviteId: string, meta: RequestMeta): Promise<void> {
    const admin = await this.staffAccount(actor, 'super_admin');
    await this.deps.db
      .update(schema.adminInvites)
      .set({ revokedAt: this.now() })
      .where(
        and(
          eq(schema.adminInvites.id, inviteId),
          isNull(schema.adminInvites.acceptedAt),
          isNull(schema.adminInvites.revokedAt),
        ),
      );
    await this.audit('admin.invite_revoked', 'success', meta, {
      accountId: admin.id,
      role: admin.role,
    });
  }

  // ---------------------------------------------------------------------------------------------
  // Sign up invite codes for viewers (M29-S03)
  // ---------------------------------------------------------------------------------------------

  async createSignupInvite(
    actor: Actor,
    input: { label: string; maxUses: number; expiresAt: Date | null },
    meta: RequestMeta,
  ): Promise<{ id: string; code: string }> {
    const admin = await this.staffAccount(actor, 'admin');
    const now = this.now();
    const label = input.label.trim();
    const fields: Record<string, string> = {};
    if (label.length > 60) fields.label = 'Use 60 characters or fewer';
    if (!Number.isInteger(input.maxUses) || input.maxUses < 1 || input.maxUses > 1000)
      fields.maxUses = 'Use a number from 1 to 1000';
    if (input.expiresAt && input.expiresAt <= now) fields.expiresAt = 'Choose a date in the future';
    if (Object.keys(fields).length > 0) throw new FieldErrors(fields);

    const code = generateInviteCode();
    const id = uuidv7();
    await this.deps.db.insert(schema.signupInvites).values({
      id,
      codeHash: inviteCodeHash(code)!,
      hint: code.slice(-2),
      label,
      maxUses: input.maxUses,
      expiresAt: input.expiresAt,
      createdBy: admin.id,
      createdAt: now,
    });
    await this.audit('admin.signup_invite_created', 'success', meta, {
      accountId: admin.id,
      role: admin.role,
      metadata: { inviteId: id, label, maxUses: input.maxUses },
      target: { type: 'signup_invite', id },
    });
    return { id, code };
  }

  async listSignupInvites(actor: Actor): Promise<SignupInviteSummary[]> {
    await this.staffAccount(actor, 'admin');
    const now = this.now();
    const rows = await this.deps.db
      .select()
      .from(schema.signupInvites)
      .orderBy(desc(schema.signupInvites.createdAt))
      .limit(200);
    return rows.map((row) => ({
      id: row.id,
      label: row.label,
      hint: row.hint,
      uses: row.uses,
      maxUses: row.maxUses,
      expiresAt: row.expiresAt,
      createdAt: row.createdAt,
      status: inviteStatus(row, now),
    }));
  }

  async revokeSignupInvite(actor: Actor, inviteId: string, meta: RequestMeta): Promise<void> {
    const admin = await this.staffAccount(actor, 'admin');
    const revoked = await this.deps.db
      .update(schema.signupInvites)
      .set({ revokedAt: this.now() })
      .where(and(eq(schema.signupInvites.id, inviteId), isNull(schema.signupInvites.revokedAt)))
      .returning({ id: schema.signupInvites.id });
    if (revoked.length === 0) throw new NotFound();
    await this.audit('admin.signup_invite_revoked', 'success', meta, {
      accountId: admin.id,
      role: admin.role,
      metadata: { inviteId },
      target: { type: 'signup_invite', id: inviteId },
    });
  }

  private async findInvite(token: string) {
    if (!token || token.length > 64) throw new TokenRejected('invalid');
    const [row] = await this.deps.db
      .select()
      .from(schema.adminInvites)
      .where(eq(schema.adminInvites.tokenHash, Buffer.from(hashToken(token))));
    if (!row || row.revokedAt) throw new TokenRejected('invalid');
    if (row.acceptedAt) throw new TokenRejected('used');
    if (row.expiresAt <= this.now()) throw new TokenRejected('expired');
    return row;
  }

  async inspectInvite(token: string): Promise<{ role: StaffRole; existingAccount: boolean }> {
    const row = await this.findInvite(token);
    const existing = await findAccountByEmailHash(this.deps.db, new Uint8Array(row.emailHash));
    return { role: row.role as StaffRole, existingAccount: existing !== null };
  }

  async acceptInvite(
    input: { token: string; password: string },
    meta: RequestMeta,
  ): Promise<{
    status: StaffSignIn['status'];
    codeSent?: boolean;
    accountId: string;
    session: { token: string; id: string };
  }> {
    const invite = await this.findInvite(input.token);
    const email = this.openInviteEmail(invite.id, invite.emailEnc);
    const hash = new Uint8Array(invite.emailHash);
    const role = invite.role as AccountRole;
    const now = this.now();
    const existing = await findAccountByEmailHash(this.deps.db, hash);
    let accountId: string;

    if (existing) {
      if (existing.status !== 'active') throw new TokenRejected('invalid');
      const key = this.lockKey(hash);
      const lock = await this.closed(() => this.deps.lockouts.status(key));
      if (lock.locked) throw new RateLimited(lock.retryAfterSeconds);
      const ok = existing.passwordHash
        ? await this.deps.hasher.verify(existing.passwordHash, input.password)
        : false;
      if (!ok) {
        await this.registerAccountFailure(
          hash,
          existing.id,
          email,
          meta,
          LOCKOUT_POLICIES.viewerLogin,
        );
        throw new FieldErrors({ password: 'Password is not right' });
      }
      await this.closed(() => this.deps.lockouts.clear(key));
      accountId = existing.id;
      await withAccount(this.deps.db, { accountId, role: existing.role }, async (tx) => {
        await this.claimInvite(tx, invite.id, now);
        await tx
          .update(schema.accounts)
          .set({ role, emailVerifiedAt: now })
          .where(eq(schema.accounts.id, accountId));
      });
      await this.deps.sessions.revokeAll(accountId);
    } else {
      const problem =
        this.passwordProblem(input.password, email) ?? (await this.breachProblem(input.password));
      if (problem) throw new FieldErrors({ password: problem });
      const passwordHash = await this.deps.hasher.hash(input.password);
      accountId = uuidv7();
      await this.deps.keys.createForAccount(accountId);
      try {
        const emailEnc = await this.deps.keys.seal(accountId, 'email', email);
        await withAccount(this.deps.db, { accountId, role: 'viewer' }, async (tx) => {
          await this.claimInvite(tx, invite.id, now);
          await tx.insert(schema.accounts).values({
            id: accountId,
            emailHash: Buffer.from(hash),
            emailEnc,
            passwordHash,
            role,
            emailVerifiedAt: now,
          });
        });
      } catch (error) {
        await this.deps.keys.destroy(accountId).catch(() => undefined);
        if (isUniqueViolation(error)) throw new TokenRejected('invalid');
        throw error;
      }
    }

    const session = await this.deps.sessions.create({
      accountId,
      kind: 'pending_mfa',
      ipTrunc: meta.ipTrunc,
      userAgent: meta.userAgent,
    });
    await this.audit('admin.invite_accepted', 'success', meta, {
      accountId,
      role,
      metadata: { existing: Boolean(existing) },
    });
    const step = await this.secondStepFor(accountId);
    const codeSent =
      step === 'email' ? (await this.mailCode(accountId, role, 'staff_sign_in', meta, 'reuse')).sent : undefined;
    return {
      status: STEP_STATUS[step],
      ...(codeSent === undefined ? {} : { codeSent }),
      accountId,
      session: { token: session.token, id: session.session.id },
    };
  }

  private async claimInvite(
    tx: Pick<typeof this.deps.db, 'update'>,
    inviteId: string,
    now: Date,
  ): Promise<void> {
    const claimed = await tx
      .update(schema.adminInvites)
      .set({ acceptedAt: now })
      .where(
        and(
          eq(schema.adminInvites.id, inviteId),
          isNull(schema.adminInvites.acceptedAt),
          isNull(schema.adminInvites.revokedAt),
        ),
      )
      .returning({ id: schema.adminInvites.id });
    if (claimed.length === 0) throw new TokenRejected('used');
  }

  // ---------------------------------------------------------------------------------------------
  // Deleting a viewer account at the owner's request (M27-S03 AC3, Super admin only)
  // ---------------------------------------------------------------------------------------------

  async deleteViewerAccount(
    actor: Actor,
    input: { accountId: string; confirmation: string },
    meta: RequestMeta,
  ): Promise<{ purgeAfter: Date }> {
    const boss = await this.staffAccount(actor, 'super_admin');
    if (input.confirmation !== 'DELETE')
      throw new FieldErrors({ confirmation: 'Type DELETE in capital letters to confirm' });
    const now = this.now();
    const purgeAfter = new Date(now.getTime() + this.deletionGraceDays() * 86400_000);
    let owner: { emailEnc: Uint8Array | null } | undefined;
    try {
      owner = await withAccount(
        this.deps.db,
        { accountId: boss.id, role: boss.role },
        async (tx) => {
          const [row] = await tx
            .select({ emailEnc: schema.accounts.emailEnc })
            .from(schema.accounts)
            .where(
              and(eq(schema.accounts.id, input.accountId), eq(schema.accounts.role, 'viewer')),
            );
          await tx.execute(
            sql`SELECT staff_request_account_deletion(${boss.id}::uuid, ${input.accountId}::uuid, ${purgeAfter.toISOString()}::timestamptz)`,
          );
          return row;
        },
      );
    } catch (error) {
      switch (pgCode(error)) {
        case '42501':
        case 'AD002':
          throw new Forbidden('You cannot delete this account');
        case 'AD003':
          throw new NotFound();
        default:
          throw error;
      }
    }
    await this.deps.sessions.revokeAll(input.accountId);
    await this.deps.audit.record({
      action: 'admin.account_deletion_requested',
      outcome: 'success',
      actorAccountId: boss.id,
      actorRole: boss.role,
      targetType: 'account',
      targetId: input.accountId,
      ipTrunc: meta.ipTrunc,
      requestId: meta.requestId,
    });
    if (owner?.emailEnc) {
      const to = await this.deps.keys.open(
        input.accountId,
        'email',
        new Uint8Array(owner.emailEnc),
      );
      this.run(() =>
        this.deps.mailer.sendDeletionScheduled({
          to,
          purgeDate: formatDate(purgeAfter),
          days: this.deletionGraceDays(),
        }),
      );
    }
    return { purgeAfter };
  }

  // ---------------------------------------------------------------------------------------------
  // Roles
  // ---------------------------------------------------------------------------------------------

  async listStaff(actor: Actor): Promise<StaffMember[]> {
    const admin = await this.staffAccount(actor, 'super_admin');
    const rows = await withAccount(this.deps.db, { accountId: admin.id, role: admin.role }, (tx) =>
      tx
        .select({
          id: schema.accounts.id,
          emailEnc: schema.accounts.emailEnc,
          role: schema.accounts.role,
          lastLoginAt: schema.accounts.lastLoginAt,
        })
        .from(schema.accounts)
        .where(and(ne(schema.accounts.role, 'viewer'), eq(schema.accounts.status, 'active'))),
    );
    const ids = rows.map((row) => row.id);
    const factors = ids.length
      ? await this.deps.db
          .select({
            accountId: schema.mfaFactors.accountId,
            confirmedAt: schema.mfaFactors.confirmedAt,
          })
          .from(schema.mfaFactors)
          .where(inArray(schema.mfaFactors.accountId, ids))
      : [];
    const enrolled = new Set(factors.filter((f) => f.confirmedAt).map((f) => f.accountId));
    const members: StaffMember[] = [];
    for (const row of rows) {
      if (!row.emailEnc || !isStaffRole(row.role)) continue;
      members.push({
        accountId: row.id,
        email: await this.deps.keys.open(row.id, 'email', row.emailEnc),
        role: row.role,
        lastLoginAt: row.lastLoginAt,
        twoFactor: enrolled.has(row.id),
      });
    }
    return members;
  }

  async changeRole(
    actor: Actor,
    input: { accountId: string; role: string; expectedRole: string },
    meta: RequestMeta,
  ): Promise<void> {
    const admin = await this.staffAccount(actor, 'super_admin');
    await this.assertRecentReauth(actor);
    if (
      !ACCOUNT_ROLES.includes(input.role as AccountRole) ||
      !ACCOUNT_ROLES.includes(input.expectedRole as AccountRole)
    ) {
      throw new FieldErrors({ role: 'Choose a valid role' });
    }
    let previous: string;
    try {
      const result = await withAccount(
        this.deps.db,
        { accountId: admin.id, role: admin.role },
        (tx) =>
          tx.execute<{ staff_set_role: string }>(
            sql`SELECT staff_set_role(${admin.id}::uuid, ${input.accountId}::uuid, ${input.role}::account_role, ${input.expectedRole}::account_role)`,
          ),
      );
      previous = result.rows[0]?.staff_set_role ?? input.expectedRole;
    } catch (error) {
      switch (pgCode(error)) {
        case '42501':
        case 'AD002':
          throw new Forbidden('You cannot change this role');
        case 'AD003':
          throw new NotFound();
        case 'AD004':
          throw new Conflict('Someone else changed this role. Reload and try again.');
        case '23514':
          throw new Conflict('There must be at least one Super admin');
        default:
          throw error;
      }
    }
    // L-7: any change of role ends the target's sessions, so a demotion or promotion never rides an old session.
    if (previous !== input.role) await this.deps.sessions.revokeAll(input.accountId);
    await this.deps.audit.record({
      action: 'admin.role_changed',
      outcome: 'success',
      actorAccountId: admin.id,
      actorRole: admin.role,
      targetType: 'account',
      targetId: input.accountId,
      ipTrunc: meta.ipTrunc,
      requestId: meta.requestId,
      metadata: { from: previous, to: input.role },
    });
  }
}
