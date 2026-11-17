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
  type AccountRole,
} from '@ad/shared';
import { and, eq, inArray, isNull, ne, sql } from 'drizzle-orm';
import { AccountService } from './accounts';
import { emailHash, maskEmail, normalizeEmail } from './identifiers';
import { findAccountByEmailHash, isUniqueViolation } from './lookup';
import {
  base32Decode,
  base32Encode,
  generateRecoveryCodes,
  generateTotpSecret,
  hashRecoveryCode,
  normalizeRecoveryCode,
  otpauthUri,
  qrSvg,
  verifyTotp,
} from './totp';
import { generateToken, hashToken } from './tokens';
import {
  FieldErrors,
  InvalidCredentials,
  ReauthRequired,
  TokenRejected,
  type Actor,
  type RequestMeta,
} from './types';

type StaffRole = 'editor' | 'admin';
const isStaffRole = (role: string): role is StaffRole => role === 'editor' || role === 'admin';

const enc = new TextEncoder();
const dec = new TextDecoder();

export interface StaffSignIn {
  status: 'enrol_required' | 'mfa_required' | 'signed_in';
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
    if (minimum === 'admin' && account.role !== 'admin') throw new Forbidden();
    return { ...account, role: account.role as StaffRole };
  }

  /** Sensitive actions need the password confirmed within the last ten minutes (SECURITY.md section 4). */
  private async assertRecentReauth(actor: Actor): Promise<void> {
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
    const [factor] = await this.deps.db
      .select({ confirmedAt: schema.mfaFactors.confirmedAt })
      .from(schema.mfaFactors)
      .where(eq(schema.mfaFactors.accountId, account.id));
    const session = await this.deps.sessions.create({ ...sessionInput, kind: 'pending_mfa' });
    await this.audit('admin.login_password', 'success', meta, {
      accountId: account.id,
      role: account.role,
    });
    return {
      status: factor?.confirmedAt ? 'mfa_required' : 'enrol_required',
      accountId: account.id,
      session: { token: session.token, id: session.session.id },
    };
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
          .where(and(eq(schema.accounts.role, 'admin'), eq(schema.accounts.status, 'active'))),
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

  private mfaKey(accountId: string): string {
    return `mfa:${accountId}`;
  }

  private async mfaLockCheck(accountId: string): Promise<void> {
    const lock = await this.closed(() => this.deps.lockouts.status(this.mfaKey(accountId)));
    if (lock.locked) throw new RateLimited(lock.retryAfterSeconds);
  }

  private async mfaFailed(
    accountId: string,
    role: string,
    meta: RequestMeta,
    field = 'code',
  ): Promise<never> {
    await this.closed(() =>
      this.deps.lockouts.registerFailure(this.mfaKey(accountId), LOCKOUT_POLICIES.mfaCode),
    );
    await this.audit('admin.mfa_failed', 'failure', meta, { accountId, role });
    throw new FieldErrors({ [field]: 'That code is not right' });
  }

  /** Checks an authenticator code, with lockout, one step of drift and replay protection. */
  private async checkTotp(
    accountId: string,
    role: string,
    code: string,
    meta: RequestMeta,
    options: { requireConfirmed: boolean },
  ): Promise<{ factorId: string; step: number }> {
    await this.mfaLockCheck(accountId);
    const [factor] = await this.deps.db
      .select()
      .from(schema.mfaFactors)
      .where(eq(schema.mfaFactors.accountId, accountId));
    if (!factor || (options.requireConfirmed && !factor.confirmedAt)) {
      return this.mfaFailed(accountId, role, meta);
    }
    const secret = base32Decode(
      await this.deps.keys.open(accountId, 'totp_secret', factor.secretEnc),
    );
    const result = verifyTotp(secret, code, this.now().getTime(), {
      lastUsedStep: factor.lastUsedStep,
    });
    if (!result.ok) return this.mfaFailed(accountId, role, meta);
    const claimed = await this.deps.db
      .update(schema.mfaFactors)
      .set({ lastUsedStep: result.step })
      .where(
        and(
          eq(schema.mfaFactors.id, factor.id),
          sql`(${schema.mfaFactors.lastUsedStep} IS NULL OR ${schema.mfaFactors.lastUsedStep} < ${result.step})`,
        ),
      )
      .returning({ id: schema.mfaFactors.id });
    if (claimed.length === 0) return this.mfaFailed(accountId, role, meta);
    await this.closed(() => this.deps.lockouts.clear(this.mfaKey(accountId)));
    return { factorId: factor.id, step: result.step };
  }

  /** True once the second factor was confirmed, so the sign in page knows whether to enrol or ask for a code. */
  async twoFactorConfirmed(actor: Actor): Promise<boolean> {
    const account = await this.staffAccount(actor);
    const [factor] = await this.deps.db
      .select({ confirmedAt: schema.mfaFactors.confirmedAt })
      .from(schema.mfaFactors)
      .where(eq(schema.mfaFactors.accountId, account.id));
    return Boolean(factor?.confirmedAt);
  }

  async beginEnrolment(
    actor: Actor,
    _meta: RequestMeta,
  ): Promise<{ secret: string; uri: string; qrSvg: string }> {
    const account = await this.staffAccount(actor);
    const [existing] = await this.deps.db
      .select({ confirmedAt: schema.mfaFactors.confirmedAt })
      .from(schema.mfaFactors)
      .where(eq(schema.mfaFactors.accountId, account.id));
    if (existing?.confirmedAt) throw new Conflict('Two factor sign in is already set up');
    const secret = generateTotpSecret();
    const base32 = base32Encode(secret);
    const secretEnc = await this.deps.keys.seal(account.id, 'totp_secret', base32);
    await this.deps.db.delete(schema.mfaFactors).where(eq(schema.mfaFactors.accountId, account.id));
    await this.deps.db
      .insert(schema.mfaFactors)
      .values({ accountId: account.id, type: 'totp', secretEnc });
    const email = await this.deps.keys.open(account.id, 'email', account.emailEnc!);
    const uri = otpauthUri({ secret, account: email, issuer: this.cfg.issuerName });
    return { secret: base32, uri, qrSvg: await qrSvg(uri) };
  }

  async confirmEnrolment(
    actor: Actor,
    input: { code: string },
    meta: RequestMeta,
  ): Promise<{ recoveryCodes: string[]; session: { token: string; id: string } }> {
    const account = await this.staffAccount(actor);
    const { factorId } = await this.checkTotp(account.id, account.role, input.code, meta, {
      requireConfirmed: false,
    });
    await this.deps.db
      .update(schema.mfaFactors)
      .set({ confirmedAt: this.now() })
      .where(eq(schema.mfaFactors.id, factorId));
    const recoveryCodes = await this.replaceRecoveryCodes(account.id);
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

  private async replaceRecoveryCodes(accountId: string): Promise<string[]> {
    const codes = generateRecoveryCodes(10);
    await this.deps.db
      .delete(schema.mfaRecoveryCodes)
      .where(eq(schema.mfaRecoveryCodes.accountId, accountId));
    await this.deps.db.insert(schema.mfaRecoveryCodes).values(
      codes.map((code) => ({
        accountId,
        codeHash: Buffer.from(hashRecoveryCode(this.deps.pepper, code)),
      })),
    );
    return codes;
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
    await this.mfaLockCheck(account.id);
    const code = normalizeRecoveryCode(input.code);
    const claimed = code
      ? await this.deps.db
          .update(schema.mfaRecoveryCodes)
          .set({ usedAt: this.now() })
          .where(
            and(
              eq(schema.mfaRecoveryCodes.accountId, account.id),
              eq(
                schema.mfaRecoveryCodes.codeHash,
                Buffer.from(hashRecoveryCode(this.deps.pepper, code)),
              ),
              isNull(schema.mfaRecoveryCodes.usedAt),
            ),
          )
          .returning({ id: schema.mfaRecoveryCodes.id })
      : [];
    if (claimed.length === 0) return this.mfaFailed(account.id, account.role, meta);
    await this.closed(() => this.deps.lockouts.clear(this.mfaKey(account.id)));
    const unused = await this.deps.db
      .select({ id: schema.mfaRecoveryCodes.id })
      .from(schema.mfaRecoveryCodes)
      .where(
        and(
          eq(schema.mfaRecoveryCodes.accountId, account.id),
          isNull(schema.mfaRecoveryCodes.usedAt),
        ),
      );
    const session = await this.deps.sessions.promoteToStaff(actor.sessionId);
    await this.audit('admin.login', 'success', meta, {
      accountId: account.id,
      role: account.role,
      metadata: { mfa: 'recovery' },
    });
    return { remaining: unused.length, session: { token: session.token, id: session.session.id } };
  }

  async regenerateRecoveryCodes(
    actor: Actor,
    input: { code: string },
    meta: RequestMeta,
  ): Promise<string[]> {
    const account = await this.staffAccount(actor);
    await this.checkTotp(account.id, account.role, input.code, meta, { requireConfirmed: true });
    const codes = await this.replaceRecoveryCodes(account.id);
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
    await this.checkTotp(account.id, account.role, input.code, meta, { requireConfirmed: true });
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
    const admin = await this.staffAccount(actor, 'admin');
    if (input.accountId === admin.id)
      throw new Forbidden('Use a recovery code to reset your own two factor sign in');
    await this.checkTotp(admin.id, admin.role, input.code, meta, { requireConfirmed: true });
    const target = await withAccount(
      this.deps.db,
      { accountId: admin.id, role: 'admin' },
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
    await this.deps.db.delete(schema.mfaFactors).where(eq(schema.mfaFactors.accountId, target.id));
    await this.deps.db
      .delete(schema.mfaRecoveryCodes)
      .where(eq(schema.mfaRecoveryCodes.accountId, target.id));
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
    const admin = await this.staffAccount(actor, 'admin');
    await this.assertRecentReauth(actor);
    const email = normalizeEmail(input.email);
    if (!email) throw new FieldErrors({ email: 'Enter a valid email address' });
    if (!isStaffRole(input.role)) throw new FieldErrors({ role: 'Choose Editor or Admin' });
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
    await this.staffAccount(actor, 'admin');
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
    const admin = await this.staffAccount(actor, 'admin');
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
    status: 'enrol_required';
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
    return {
      status: 'enrol_required',
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
  // Roles
  // ---------------------------------------------------------------------------------------------

  async listStaff(actor: Actor): Promise<StaffMember[]> {
    const admin = await this.staffAccount(actor, 'admin');
    const rows = await withAccount(this.deps.db, { accountId: admin.id, role: 'admin' }, (tx) =>
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
    const admin = await this.staffAccount(actor, 'admin');
    await this.assertRecentReauth(actor);
    if (
      !ACCOUNT_ROLES.includes(input.role as AccountRole) ||
      !ACCOUNT_ROLES.includes(input.expectedRole as AccountRole)
    ) {
      throw new FieldErrors({ role: 'Choose a valid role' });
    }
    let previous: string;
    try {
      const result = await this.deps.db.execute<{ staff_set_role: string }>(
        sql`SELECT staff_set_role(${admin.id}::uuid, ${input.accountId}::uuid, ${input.role}::account_role, ${input.expectedRole}::account_role)`,
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
    if (input.role === 'viewer') await this.deps.sessions.revokeAll(input.accountId);
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
