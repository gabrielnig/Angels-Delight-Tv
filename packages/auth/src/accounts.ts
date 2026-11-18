import { schema, withAccount } from '@ad/db';
import { LimiterUnavailable, LOCKOUT_POLICIES, RATE_POLICIES } from '@ad/security';
import { Conflict, hmacSha256, RateLimited, sha256, uuidv7, isStaffRole } from '@ad/shared';
import { and, count, eq, isNotNull, isNull, lte } from 'drizzle-orm';
import {
  checkCode,
  findEmailToken,
  issueEmailToken,
  voidEmailTokens,
  type EmailTokenRow,
} from './email-tokens';
import { findUsableInvite, consumeInvite } from './signup-invites';
import { emailHash, maskEmail, normalizeEmail } from './identifiers';
import { findAccountByEmailHash, isUniqueViolation } from './lookup';
import { checkPassword } from './policy';
import {
  DEFAULT_AUTH_CONFIG,
  NO_META,
  AccountUnavailable,
  FieldErrors,
  InvalidCredentials,
  InviteRequired,
  TokenRejected,
  type Actor,
  type AuthConfig,
  type AuthDeps,
  type Logger,
  type RequestMeta,
} from './types';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "1 Dec 2026" in UTC, for mails. */
export function formatDate(date: Date): string {
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

export interface SignUpInput {
  email: string;
  password: string;
  acceptTerms: boolean;
  guardianDeclaration: boolean;
  /** Hidden form field real people never fill (M01-S14). Any value silently drops the submission. */
  website?: string;
  /** Needed only while sign up is by invitation (M29-S03). */
  inviteCode?: string;
}

export type VerifyCodeResult =
  | { status: 'verified'; accountId: string; session: { token: string; id: string } }
  | { status: 'invalid' | 'expired' | 'too_many' };

export type VerifyLinkResult =
  | { status: 'verified'; purpose: 'verify_email' | 'change_email' }
  | { status: 'invalid' | 'used' | 'expired' };

const NOOP_LOGGER: Logger = { warn: () => undefined, error: () => undefined };

/** Viewer accounts: sign up, verification, sign in, recovery and account changes (modules M01 and M02). */
export class AccountService {
  protected readonly cfg: AuthConfig;
  protected readonly logger: Logger;

  constructor(protected readonly deps: AuthDeps) {
    this.cfg = { ...DEFAULT_AUTH_CONFIG, ...deps.config };
    this.logger = deps.logger ?? NOOP_LOGGER;
  }

  protected now(): Date {
    return (this.deps.clock ?? (() => new Date()))();
  }

  /** Opaque, keyed identifier for rate limit and lockout keys, so raw addresses never reach those tables. */
  protected subject(kind: string, value: string): string {
    return Buffer.from(hmacSha256(this.deps.pepper, `${kind}:${value}`))
      .toString('hex')
      .slice(0, 32);
  }

  protected ipSubject(meta: RequestMeta): string {
    return this.subject('ip', meta.ip ?? 'unknown');
  }

  protected run(task: () => Promise<unknown>): void {
    const promise = task().catch((error: unknown) => {
      this.logger.error('background task failed', { error: String(error) });
    });
    (this.deps.background ?? (() => undefined))(promise);
  }

  protected async audit(
    action: string,
    outcome: 'success' | 'denied' | 'failure',
    meta: RequestMeta,
    extra: {
      accountId?: string | null;
      role?: string | null;
      metadata?: Record<string, unknown>;
      /** What the action was done to, when that is not the account in `accountId`. */
      target?: { type: string; id: string };
    } = {},
  ): Promise<void> {
    await this.deps.audit.record({
      action,
      outcome,
      actorAccountId: extra.accountId ?? null,
      actorRole: extra.role ?? null,
      targetType: extra.target?.type ?? (extra.accountId ? 'account' : null),
      targetId: extra.target?.id ?? extra.accountId ?? null,
      ipTrunc: meta.ipTrunc,
      requestId: meta.requestId,
      metadata: extra.metadata,
    });
  }

  protected passwordProblem(password: string, email: string): string | null {
    const check = checkPassword(password, email);
    if (check.ok) return null;
    const failed = check.rules.find((rule) => rule.passed !== true);
    return failed
      ? `${failed.label.replace(/^Not /, 'Choose one that is not ')}`
      : 'Choose a different password';
  }

  protected async breachProblem(password: string): Promise<string | null> {
    if (!this.deps.isBreached) return null;
    return (await this.deps.isBreached(password))
      ? 'This password appears in a known data breach. Choose another.'
      : null;
  }

  // ---------------------------------------------------------------------------------------------
  // Sign up and verification
  // ---------------------------------------------------------------------------------------------

  async signUp(
    input: SignUpInput,
    meta: RequestMeta,
  ): Promise<{ email: string; emailSent: boolean }> {
    const { open } = await (this.deps.signUpPolicy?.() ?? { open: this.cfg.signUpOpen });
    const email = normalizeEmail(input.email);
    const fields: Record<string, string> = {};
    if (!email) fields.email = 'Enter a valid email address';
    if (!input.acceptTerms) fields.acceptTerms = 'Accept the terms to continue';
    if (!input.guardianDeclaration)
      fields.guardianDeclaration = 'Confirm you are an adult or a guardian';
    if (email) {
      const problem =
        this.passwordProblem(input.password, email) ?? (await this.breachProblem(input.password));
      if (problem) fields.password = problem;
    }
    if (Object.keys(fields).length > 0 || !email) throw new FieldErrors(fields);
    if (input.website) return { email, emailSent: true };

    await this.deps.limiter.enforce(RATE_POLICIES.signupIp, this.ipSubject(meta));
    // Checked before the existing account lookup, so a wrong code cannot be used to probe which addresses exist.
    if (!open && !(await findUsableInvite(this.deps.db, input.inviteCode, this.now())))
      throw new InviteRequired();

    // Hash first on every path so a new address and an existing one cost the same time.
    const passwordHash = await this.deps.hasher.hash(input.password);
    const hash = emailHash(email, this.deps.pepper);
    const existing = await findAccountByEmailHash(this.deps.db, hash);
    if (existing) return this.signUpExisting(email, meta);

    const accountId = uuidv7();
    const now = this.now();
    await this.deps.keys.createForAccount(accountId);
    let issued: { token: string; code: string | null };
    const used: { inviteId: string | null } = { inviteId: null };
    try {
      const emailEnc = await this.deps.keys.seal(accountId, 'email', email);
      issued = await withAccount(this.deps.db, { accountId, role: 'viewer' }, async (tx) => {
        // Counted in the same transaction as the account, so a failed sign up does not burn a code.
        if (!open) used.inviteId = await consumeInvite(tx, input.inviteCode, now);
        await tx.insert(schema.accounts).values({
          id: accountId,
          emailHash: Buffer.from(hash),
          emailEnc,
          passwordHash,
        });
        await tx.insert(schema.consents).values(
          (['terms', 'privacy', 'guardian_declaration'] as const).map((kind) => ({
            accountId,
            kind,
            version: this.cfg.legalVersions[kind],
            grantedAt: now,
            ipTrunc: meta.ipTrunc,
          })),
        );
        return issueEmailToken(tx, {
          accountId,
          purpose: 'verify_email',
          ttlSeconds: this.cfg.verifyLinkTtlSeconds,
          withCode: true,
          ipTrunc: meta.ipTrunc,
          now,
          pepper: this.deps.pepper,
        });
      });
    } catch (error) {
      await this.deps.keys.destroy(accountId).catch(() => undefined);
      if (isUniqueViolation(error)) return this.signUpExisting(email, meta);
      throw error;
    }
    await this.audit('auth.signup', 'success', meta, {
      accountId,
      role: 'viewer',
      metadata: used.inviteId ? { inviteId: used.inviteId } : undefined,
    });
    const emailSent = await this.sendVerification(email, issued);
    return { email, emailSent };
  }

  /** An address that already has an account looks the same to the caller, and the owner gets a heads up. */
  private async signUpExisting(
    email: string,
    meta: RequestMeta,
  ): Promise<{ email: string; emailSent: boolean }> {
    const allowed = await this.deps.limiter.consume(
      RATE_POLICIES.resetRequestEmail,
      this.subject('mail', email),
    );
    if (allowed.allowed) {
      await this.deps.mailer.sendAlreadyRegistered({ to: email }).catch((error: unknown) => {
        this.logger.warn('already registered email failed', { error: String(error) });
      });
    }
    await this.audit('auth.signup', 'success', meta, { metadata: { existing: true } });
    return { email, emailSent: true };
  }

  protected async sendVerification(
    email: string,
    issued: { token: string; code: string | null },
    options: { change?: boolean } = {},
  ): Promise<boolean> {
    const input = { to: email, code: issued.code ?? '', token: issued.token };
    try {
      await (options.change
        ? this.deps.mailer.sendEmailChangeVerify(input)
        : this.deps.mailer.sendVerifyEmail(input));
      return true;
    } catch (error) {
      this.logger.warn('verification email failed', { error: String(error) });
      return false;
    }
  }

  async verifyCode(
    input: { email: string; code: string },
    meta: RequestMeta,
  ): Promise<VerifyCodeResult> {
    const email = normalizeEmail(input.email);
    if (!email) return { status: 'invalid' };
    const account = await findAccountByEmailHash(this.deps.db, emailHash(email, this.deps.pepper));
    if (!account || account.status !== 'active') return { status: 'invalid' };
    const now = this.now();
    const check = await checkCode(this.deps.db, {
      accountId: account.id,
      purpose: 'verify_email',
      code: input.code,
      now,
      ttlSeconds: this.cfg.verifyCodeTtlSeconds,
      maxAttempts: this.cfg.verifyCodeMaxAttempts,
      pepper: this.deps.pepper,
    });
    if (check.status !== 'ok') {
      await this.audit('auth.verify_email', 'failure', meta, {
        accountId: account.id,
        metadata: { reason: check.status },
      });
      return { status: check.status };
    }
    await this.completeVerification(account.id, now);
    this.run(() => this.deps.mailer.sendWelcome({ to: email }));
    const session = await this.deps.sessions.create({
      accountId: account.id,
      kind: 'viewer',
      ipTrunc: meta.ipTrunc,
      userAgent: meta.userAgent,
    });
    await this.audit('auth.verify_email', 'success', meta, {
      accountId: account.id,
      role: account.role,
      metadata: { method: 'code' },
    });
    return {
      status: 'verified',
      accountId: account.id,
      session: { token: session.token, id: session.session.id },
    };
  }

  private async welcomeById(accountId: string): Promise<void> {
    const enc = await withAccount(this.deps.db, { accountId, role: 'viewer' }, async (tx) => {
      const [row] = await tx
        .select({ enc: schema.accounts.emailEnc })
        .from(schema.accounts)
        .where(eq(schema.accounts.id, accountId));
      return row?.enc ?? null;
    });
    if (!enc) return;
    await this.deps.mailer.sendWelcome({ to: await this.deps.keys.open(accountId, 'email', enc) });
  }

  private async completeVerification(accountId: string, now: Date): Promise<void> {
    await withAccount(this.deps.db, { accountId, role: 'viewer' }, async (tx) => {
      await tx
        .update(schema.accounts)
        .set({ emailVerifiedAt: now })
        .where(eq(schema.accounts.id, accountId));
    });
    await voidEmailTokens(this.deps.db, accountId, 'verify_email', now);
  }

  async verifyLink(token: string, meta: RequestMeta): Promise<VerifyLinkResult> {
    const row = await findEmailToken(this.deps.db, token);
    if (!row || (row.purpose !== 'verify_email' && row.purpose !== 'change_email'))
      return { status: 'invalid' };
    if (row.usedAt) return { status: 'used' };
    const now = this.now();
    if (row.expiresAt <= now) return { status: 'expired' };
    if (row.purpose === 'change_email') {
      const applied = await this.applyEmailChange(row, meta);
      return applied ? { status: 'verified', purpose: 'change_email' } : { status: 'invalid' };
    }
    await this.completeVerification(row.accountId, now);
    this.run(() => this.welcomeById(row.accountId));
    await this.audit('auth.verify_email', 'success', meta, {
      accountId: row.accountId,
      metadata: { method: 'link' },
    });
    return { status: 'verified', purpose: 'verify_email' };
  }

  /** Moves the account to the address held by a change_email token. False when it cannot be applied. */
  protected async applyEmailChange(
    row: EmailTokenRow,
    meta: RequestMeta,
    options: { exceptSessionId?: string } = {},
  ): Promise<boolean> {
    if (!row.newEmailHash || !row.newEmailEnc) return false;
    const account = await this.loadOwn(row.accountId);
    if (!account || account.status !== 'active') return false;
    const now = this.now();
    try {
      await withAccount(this.deps.db, { accountId: account.id, role: account.role }, (tx) =>
        tx
          .update(schema.accounts)
          .set({ emailHash: row.newEmailHash, emailEnc: row.newEmailEnc, emailVerifiedAt: now })
          .where(eq(schema.accounts.id, account.id)),
      );
    } catch (error) {
      if (isUniqueViolation(error)) return false;
      throw error;
    }
    await this.consumeToken(row.id, now);
    await this.deps.sessions.revokeAll(account.id, { exceptSessionId: options.exceptSessionId });
    await this.audit('auth.email_changed', 'success', meta, {
      accountId: account.id,
      role: account.role,
    });
    return true;
  }

  async resendVerification(input: { email: string }, meta: RequestMeta): Promise<{ sent: true }> {
    const email = normalizeEmail(input.email);
    if (!email) return { sent: true };
    await this.deps.limiter.enforce(RATE_POLICIES.verifyResendAccount, this.subject('mail', email));
    const account = await findAccountByEmailHash(this.deps.db, emailHash(email, this.deps.pepper));
    if (!account || account.status !== 'active') return { sent: true };
    const [row] = await withAccount(this.deps.db, { accountId: account.id, role: 'viewer' }, (tx) =>
      tx
        .select({ verified: schema.accounts.emailVerifiedAt })
        .from(schema.accounts)
        .where(eq(schema.accounts.id, account.id)),
    );
    if (row?.verified) {
      // Same cost and same mail as a repeat sign up, so this screen cannot be used to probe addresses.
      await this.deps.mailer.sendAlreadyRegistered({ to: email });
      return { sent: true };
    }
    await this.sendNewVerification(account.id, email, meta, true);
    return { sent: true };
  }

  /** Lets an expired or used verification link ask for a fresh email, since the token already names the account. */
  async resendForToken(token: string, meta: RequestMeta): Promise<{ sent: true }> {
    const row = await findEmailToken(this.deps.db, token);
    if (!row || row.purpose !== 'verify_email') return { sent: true };
    await this.deps.limiter.enforce(
      RATE_POLICIES.verifyResendAccount,
      this.subject('acct', row.accountId),
    );
    const email = await this.deps.keys
      .open(
        row.accountId,
        'email',
        await withAccount(
          this.deps.db,
          { accountId: row.accountId, role: 'viewer' },
          async (tx) => {
            const [account] = await tx
              .select({ enc: schema.accounts.emailEnc })
              .from(schema.accounts)
              .where(eq(schema.accounts.id, row.accountId));
            return account?.enc ?? Buffer.alloc(0);
          },
        ),
      )
      .catch(() => null);
    if (email) await this.sendNewVerification(row.accountId, email, meta, false);
    return { sent: true };
  }

  protected async sendNewVerification(
    accountId: string,
    email: string,
    meta: RequestMeta,
    surfaceFailure: boolean,
  ): Promise<void> {
    const issued = await issueEmailToken(this.deps.db, {
      accountId,
      purpose: 'verify_email',
      ttlSeconds: this.cfg.verifyLinkTtlSeconds,
      withCode: true,
      ipTrunc: meta.ipTrunc,
      now: this.now(),
      pepper: this.deps.pepper,
    });
    const sent = await this.sendVerification(email, issued);
    if (!sent && surfaceFailure) {
      const { MailDeliveryError } = await import('@ad/mailer');
      throw new MailDeliveryError();
    }
  }

  // ---------------------------------------------------------------------------------------------
  // Password reset request (the rest of recovery arrives with the sign in slice)
  // ---------------------------------------------------------------------------------------------

  async requestPasswordReset(input: { email: string }, meta: RequestMeta): Promise<void> {
    const email = normalizeEmail(input.email);
    if (!email) return;
    const byEmail = await this.deps.limiter.consume(
      RATE_POLICIES.resetRequestEmail,
      this.subject('reset', email),
    );
    const byIp = await this.deps.limiter.consume(
      RATE_POLICIES.resetRequestIp,
      this.ipSubject(meta),
    );
    if (!byEmail.allowed || !byIp.allowed) {
      await this.audit('auth.reset_requested', 'denied', meta);
      return;
    }
    const account = await findAccountByEmailHash(this.deps.db, emailHash(email, this.deps.pepper));
    if (!account || account.status !== 'active') return;
    const verified = await withAccount(
      this.deps.db,
      { accountId: account.id, role: 'viewer' },
      async (tx) => {
        const [row] = await tx
          .select({ verified: schema.accounts.emailVerifiedAt })
          .from(schema.accounts)
          .where(eq(schema.accounts.id, account.id));
        return Boolean(row?.verified);
      },
    );
    // Mail goes out after the response is decided, so timing does not reveal whether the address exists.
    this.run(async () => {
      if (!verified) {
        await this.sendNewVerification(account.id, email, meta, false);
        return;
      }
      const issued = await issueEmailToken(this.deps.db, {
        accountId: account.id,
        purpose: 'reset_password',
        ttlSeconds: this.cfg.resetTtlSeconds,
        ipTrunc: meta.ipTrunc,
        now: this.now(),
        pepper: this.deps.pepper,
      });
      await this.deps.mailer.sendPasswordReset({
        to: email,
        token: issued.token,
        minutes: Math.round(this.cfg.resetTtlSeconds / 60),
      });
    });
    await this.audit('auth.reset_requested', 'success', meta, {
      accountId: account.id,
      role: account.role,
    });
  }

  // ---------------------------------------------------------------------------------------------
  // Sign in, lockout and sign out
  // ---------------------------------------------------------------------------------------------

  protected lockKey(hash: Uint8Array): string {
    return `acct:${Buffer.from(hash).toString('hex')}`;
  }

  /** The lockout that password checks on an open session count toward. Staff override this (M12-S09). */
  protected passwordLockKey(hash: Uint8Array, _role: string): string {
    return this.lockKey(hash);
  }

  protected registerPasswordFailure(
    hash: Uint8Array,
    accountId: string,
    _role: string,
    email: string,
    meta: RequestMeta,
    policy: typeof LOCKOUT_POLICIES.viewerLogin,
  ): Promise<void> {
    return this.registerAccountFailure(hash, accountId, email, meta, policy);
  }

  /** Clears every lockout a password reset should lift. Staff also lift the admin lockout. */
  protected async clearPasswordLocks(hash: Uint8Array, _role: string): Promise<void> {
    await this.closed(() => this.deps.lockouts.clear(this.lockKey(hash)));
  }

  /** Limiter and lockout stores must fail closed on auth routes (M23-S03 AC2). */
  protected async closed<T>(task: () => Promise<T>): Promise<T> {
    try {
      return await task();
    } catch (error) {
      if (error instanceof RateLimited || error instanceof LimiterUnavailable) throw error;
      throw new LimiterUnavailable({ cause: error });
    }
  }

  async signIn(
    input: { email: string; password: string },
    meta: RequestMeta,
  ): Promise<
    | {
        status: 'signed_in';
        accountId: string;
        role: string;
        session: { token: string; id: string };
      }
    | { status: 'needs_verification'; email: string }
    | { status: 'use_admin_login' }
    | {
        status: 'pending_deletion';
        accountId: string;
        role: string;
        purgeAfter: Date;
        session: { token: string; id: string };
      }
  > {
    const email = normalizeEmail(input.email);
    const hash = email ? emailHash(email, this.deps.pepper) : null;
    const ipKey = this.ipSubject(meta);

    const ip = await this.closed(() => this.deps.limiter.peek(RATE_POLICIES.loginIp, ipKey));
    if (!ip.allowed) {
      await this.audit('auth.rate_limited', 'denied', meta, { metadata: { scope: 'login_ip' } });
      throw new RateLimited(ip.retryAfterSeconds);
    }
    if (hash) {
      const lock = await this.closed(() => this.deps.lockouts.status(this.lockKey(hash)));
      if (lock.locked) {
        await this.audit('auth.rate_limited', 'denied', meta, {
          metadata: { scope: 'login_account' },
        });
        throw new RateLimited(lock.retryAfterSeconds);
      }
    }

    const account = hash ? await findAccountByEmailHash(this.deps.db, hash) : null;
    let verified = false;
    if (account?.passwordHash) {
      verified = await this.deps.hasher.verify(account.passwordHash, input.password);
    } else {
      await this.deps.hasher.verifyDummy(input.password);
    }
    if (!account || !verified || !email || !hash) {
      await this.loginFailed(email, hash, account?.id ?? null, meta, ipKey);
      throw new InvalidCredentials();
    }

    // L-6: staff sign in at /admin/login only. Reached only with the right password, so a wrong guess learns nothing.
    if (isStaffRole(account.role)) {
      await this.audit('auth.login', 'denied', meta, {
        accountId: account.id,
        role: account.role,
        metadata: { reason: 'staff_use_admin_login' },
      });
      return { status: 'use_admin_login' };
    }

    if (account.status === 'pending_deletion') {
      // M02-S08 AC2: the right password opens a session that can only see the cancel screen.
      await this.closed(() => this.deps.lockouts.clear(this.lockKey(hash)));
      const [pending] = await this.deps.db
        .select({ purgeAfter: schema.accountDeletions.purgeAfter })
        .from(schema.accountDeletions)
        .where(eq(schema.accountDeletions.accountId, account.id));
      const session = await this.deps.sessions.create({
        accountId: account.id,
        kind: 'viewer',
        ipTrunc: meta.ipTrunc,
        userAgent: meta.userAgent,
      });
      await this.audit('auth.login', 'success', meta, {
        accountId: account.id,
        role: account.role,
        metadata: { pending_deletion: true },
      });
      return {
        status: 'pending_deletion',
        accountId: account.id,
        role: account.role,
        purgeAfter: pending?.purgeAfter ?? this.now(),
        session: { token: session.token, id: session.session.id },
      };
    }
    if (account.status !== 'active') {
      await this.audit('auth.login', 'denied', meta, {
        accountId: account.id,
        role: account.role,
        metadata: { reason: 'status' },
      });
      throw new AccountUnavailable();
    }

    await this.closed(() => this.deps.lockouts.clear(this.lockKey(hash)));
    const state = await withAccount(
      this.deps.db,
      { accountId: account.id, role: account.role },
      async (tx) => {
        const [row] = await tx
          .select({ verifiedAt: schema.accounts.emailVerifiedAt })
          .from(schema.accounts)
          .where(eq(schema.accounts.id, account.id));
        if (account.passwordHash && this.deps.hasher.needsRehash(account.passwordHash)) {
          await tx
            .update(schema.accounts)
            .set({ passwordHash: await this.deps.hasher.hash(input.password) })
            .where(eq(schema.accounts.id, account.id));
        }
        return row;
      },
    );

    if (!state?.verifiedAt) {
      this.run(async () => {
        const allowed = await this.deps.limiter.consume(
          RATE_POLICIES.verifyResendAccount,
          this.subject('mail', email),
        );
        if (allowed.allowed) await this.sendNewVerification(account.id, email, meta, false);
      });
      await this.audit('auth.login', 'success', meta, {
        accountId: account.id,
        role: account.role,
        metadata: { verified: false },
      });
      return { status: 'needs_verification', email };
    }

    const now = this.now();
    await withAccount(this.deps.db, { accountId: account.id, role: account.role }, (tx) =>
      tx
        .update(schema.accounts)
        .set({ lastLoginAt: now })
        .where(eq(schema.accounts.id, account.id)),
    );
    const session = await this.deps.sessions.create({
      accountId: account.id,
      kind: 'viewer',
      ipTrunc: meta.ipTrunc,
      userAgent: meta.userAgent,
    });
    await this.audit('auth.login', 'success', meta, { accountId: account.id, role: account.role });
    return {
      status: 'signed_in',
      accountId: account.id,
      role: account.role,
      session: { token: session.token, id: session.session.id },
    };
  }

  private async loginFailed(
    email: string | null,
    hash: Uint8Array | null,
    accountId: string | null,
    meta: RequestMeta,
    ipKey: string,
  ): Promise<void> {
    await this.closed(() => this.deps.limiter.consume(RATE_POLICIES.loginIp, ipKey));
    await this.audit('auth.login', 'failure', meta, { accountId });
    if (!hash || !email) return;
    await this.registerAccountFailure(hash, accountId, email, meta, LOCKOUT_POLICIES.viewerLogin);
  }

  /** Counts one failure against the account key and, when it starts a lock, mails the owner at most hourly. */
  protected async registerAccountFailure(
    hash: Uint8Array,
    accountId: string | null,
    email: string,
    meta: RequestMeta,
    policy: typeof LOCKOUT_POLICIES.viewerLogin,
  ): Promise<void> {
    const state = await this.closed(() =>
      this.deps.lockouts.registerFailure(this.lockKey(hash), policy),
    );
    if (!state.justLocked) return;
    await this.audit('auth.lockout', 'denied', meta, {
      accountId,
      metadata: { minutes: Math.round(policy.lockSeconds / 60) },
    });
    if (!accountId) return;
    this.run(async () => {
      const allowed = await this.deps.limiter.consume(
        RATE_POLICIES.lockoutNoticeAccount,
        this.subject('acct', accountId),
      );
      if (allowed.allowed) {
        await this.deps.mailer.sendLockoutNotice({
          to: email,
          minutes: Math.round(policy.lockSeconds / 60),
        });
      }
    });
  }

  async signOut(token: string, meta: RequestMeta): Promise<void> {
    try {
      const context = await this.deps.sessions.validate(token);
      await this.deps.sessions.revokeByToken(token);
      if (context)
        await this.audit('auth.logout', 'success', meta, {
          accountId: context.accountId,
          role: context.role,
        });
    } catch (error) {
      // The cookie is cleared by the caller either way (M01-S10 error case).
      this.logger.error('sign out failed', { error: String(error) });
    }
  }

  // ---------------------------------------------------------------------------------------------
  // Password reset and change
  // ---------------------------------------------------------------------------------------------

  protected async loadOwn(accountId: string) {
    return withAccount(this.deps.db, { accountId, role: 'viewer' }, async (tx) => {
      const [row] = await tx
        .select()
        .from(schema.accounts)
        .where(eq(schema.accounts.id, accountId));
      return row ?? null;
    });
  }

  /** Marks a token used. False when another request used it first. */
  protected async consumeToken(tokenId: string, now: Date): Promise<boolean> {
    const rows = await this.deps.db
      .update(schema.emailTokens)
      .set({ usedAt: now })
      .where(and(eq(schema.emailTokens.id, tokenId), isNull(schema.emailTokens.usedAt)))
      .returning({ id: schema.emailTokens.id });
    return rows.length > 0;
  }

  async resetPassword(
    input: { token: string; password: string },
    meta: RequestMeta,
  ): Promise<void> {
    const row = await findEmailToken(this.deps.db, input.token);
    if (!row || row.purpose !== 'reset_password') throw new TokenRejected('invalid');
    if (row.usedAt) throw new TokenRejected('used');
    const now = this.now();
    if (row.expiresAt <= now) throw new TokenRejected('expired');
    const account = await this.loadOwn(row.accountId);
    if (!account || account.status !== 'active' || !account.emailEnc || !account.emailHash) {
      throw new TokenRejected('invalid');
    }
    const email = await this.deps.keys.open(account.id, 'email', account.emailEnc);
    const problem =
      this.passwordProblem(input.password, email) ?? (await this.breachProblem(input.password));
    if (problem) throw new FieldErrors({ password: problem });
    if (
      account.passwordHash &&
      (await this.deps.hasher.verify(account.passwordHash, input.password))
    ) {
      throw new FieldErrors({ password: 'Choose a different password from your current one' });
    }
    const passwordHash = await this.deps.hasher.hash(input.password);
    if (!(await this.consumeToken(row.id, now))) throw new TokenRejected('used');
    await withAccount(this.deps.db, { accountId: account.id, role: account.role }, (tx) =>
      tx
        .update(schema.accounts)
        .set({
          passwordHash,
          passwordChangedAt: now,
          emailVerifiedAt: account.emailVerifiedAt ?? now,
        })
        .where(eq(schema.accounts.id, account.id)),
    );
    await this.deps.sessions.revokeAll(account.id);
    await this.clearPasswordLocks(account.emailHash!, account.role);
    await this.audit('auth.password_reset', 'success', meta, {
      accountId: account.id,
      role: account.role,
    });
    this.run(() => this.deps.mailer.sendPasswordChanged({ to: email }));
  }

  /**
   * Re-checks the password of a signed in account. Wrong answers count toward the same lockout as sign in
   * (M02-S03, M01-S11). On success the session records a fresh reauthentication.
   */
  protected async confirmPassword(
    actor: Actor,
    password: string,
    meta: RequestMeta,
    field: string,
    message: string,
    policy: typeof LOCKOUT_POLICIES.viewerLogin = LOCKOUT_POLICIES.viewerLogin,
  ) {
    const account = await this.loadOwn(actor.accountId);
    if (
      !account ||
      account.status !== 'active' ||
      !account.emailHash ||
      !account.emailEnc ||
      !account.passwordHash
    ) {
      throw new AccountUnavailable();
    }
    const key = this.passwordLockKey(account.emailHash, account.role);
    const lock = await this.closed(() => this.deps.lockouts.status(key));
    if (lock.locked) throw new RateLimited(lock.retryAfterSeconds);
    if (!(await this.deps.hasher.verify(account.passwordHash, password))) {
      const email = await this.deps.keys.open(account.id, 'email', account.emailEnc);
      await this.registerPasswordFailure(
        account.emailHash,
        account.id,
        account.role,
        email,
        meta,
        policy,
      );
      await this.audit('auth.reauth', 'failure', meta, {
        accountId: account.id,
        role: account.role,
      });
      throw new FieldErrors({ [field]: message });
    }
    await this.closed(() => this.deps.lockouts.clear(key));
    await this.deps.sessions.markReauth(actor.sessionId);
    return {
      account,
      passwordHash: account.passwordHash,
      email: () => this.deps.keys.open(account.id, 'email', account.emailEnc!),
    };
  }

  /** Wrong password confirmations left before the account locks, for the Kids exit prompt. */
  async triesLeft(actor: Actor): Promise<number> {
    const account = await this.loadOwn(actor.accountId);
    const max = LOCKOUT_POLICIES.viewerLogin.maxFailures;
    if (!account?.emailHash) return max;
    const state = await this.closed(() =>
      this.deps.lockouts.status(this.lockKey(account.emailHash!), LOCKOUT_POLICIES.viewerLogin),
    );
    return Math.max(0, max - state.failures);
  }

  /** Confirms the password for a sensitive action and returns when it was confirmed. */
  async reauthenticate(actor: Actor, password: string, meta: RequestMeta): Promise<void> {
    await this.confirmPassword(actor, password, meta, 'password', 'Password is not right');
  }

  async changePassword(
    actor: Actor,
    input: { currentPassword: string; newPassword: string },
    meta: RequestMeta,
    sessionKind: 'viewer' | 'staff' = 'viewer',
  ): Promise<{ session: { token: string; id: string } }> {
    const confirmed = await this.confirmPassword(
      actor,
      input.currentPassword,
      meta,
      'currentPassword',
      'Current password is not right',
    );
    const email = await confirmed.email();
    if (input.newPassword === input.currentPassword) {
      throw new FieldErrors({ newPassword: 'Choose a different password from your current one' });
    }
    const problem =
      this.passwordProblem(input.newPassword, email) ??
      (await this.breachProblem(input.newPassword));
    if (problem) throw new FieldErrors({ newPassword: problem });
    const passwordHash = await this.deps.hasher.hash(input.newPassword);
    const now = this.now();
    await withAccount(this.deps.db, { accountId: actor.accountId, role: actor.role }, (tx) =>
      tx
        .update(schema.accounts)
        .set({ passwordHash, passwordChangedAt: now })
        .where(eq(schema.accounts.id, actor.accountId)),
    );
    await this.deps.sessions.revokeAll(actor.accountId);
    const session = await this.deps.sessions.create({
      accountId: actor.accountId,
      kind: sessionKind,
      ipTrunc: meta.ipTrunc,
      userAgent: meta.userAgent,
    });
    await this.deps.sessions.markReauth(session.session.id);
    await this.audit('auth.password_changed', 'success', meta, {
      accountId: actor.accountId,
      role: actor.role,
    });
    this.run(() => this.deps.mailer.sendPasswordChanged({ to: email }));
    return { session: { token: session.token, id: session.session.id } };
  }

  async signOutEverywhere(actor: Actor, password: string, meta: RequestMeta): Promise<void> {
    await this.confirmPassword(actor, password, meta, 'password', 'Password is not right');
    await this.deps.sessions.revokeAll(actor.accountId);
    await this.audit('auth.sign_out_everywhere', 'success', meta, {
      accountId: actor.accountId,
      role: actor.role,
    });
  }

  // ---------------------------------------------------------------------------------------------
  // Account area (screens 27 to 30)
  // ---------------------------------------------------------------------------------------------

  async getOverview(actor: Actor): Promise<{
    email: string;
    emailVerified: boolean;
    memberSince: Date;
    profileCount: number;
    role: string;
  }> {
    const account = await this.loadOwn(actor.accountId);
    if (!account || !account.emailEnc) throw new AccountUnavailable();
    const email = await this.deps.keys.open(account.id, 'email', account.emailEnc);
    const [profiles] = await withAccount(
      this.deps.db,
      { accountId: actor.accountId, role: actor.role },
      (tx) =>
        tx
          .select({ total: count() })
          .from(schema.profiles)
          .where(eq(schema.profiles.accountId, actor.accountId)),
    );
    return {
      email,
      emailVerified: account.emailVerifiedAt !== null,
      memberSince: account.createdAt,
      profileCount: profiles?.total ?? 0,
      role: account.role,
    };
  }

  /**
   * Starts an email change (M02-S02). The new address gets a code, the old one gets a notice, and nothing
   * changes until the code is entered. A taken address looks identical and its owner is warned instead.
   */
  async requestEmailChange(
    actor: Actor,
    input: { newEmail: string; password: string },
    meta: RequestMeta,
  ): Promise<{ pendingEmail: string }> {
    const confirmed = await this.confirmPassword(
      actor,
      input.password,
      meta,
      'password',
      'Password is not right',
    );
    const oldEmail = await confirmed.email();
    const target = normalizeEmail(input.newEmail);
    if (!target) throw new FieldErrors({ newEmail: 'Enter a valid email address' });
    if (target === oldEmail) throw new FieldErrors({ newEmail: 'That is already your email' });
    const hash = emailHash(target, this.deps.pepper);
    const existing = await findAccountByEmailHash(this.deps.db, hash);
    if (existing) {
      const allowed = await this.deps.limiter.consume(
        RATE_POLICIES.resetRequestEmail,
        this.subject('mail', target),
      );
      if (allowed.allowed)
        await this.deps.mailer.sendAlreadyRegistered({ to: target }).catch(() => undefined);
      return { pendingEmail: target };
    }
    const issued = await issueEmailToken(this.deps.db, {
      accountId: actor.accountId,
      purpose: 'change_email',
      ttlSeconds: this.cfg.emailChangeTtlSeconds,
      withCode: true,
      newEmail: { enc: await this.deps.keys.seal(actor.accountId, 'email', target), hash },
      ipTrunc: meta.ipTrunc,
      now: this.now(),
      pepper: this.deps.pepper,
    });
    const sent = await this.sendVerification(target, issued, { change: true });
    if (!sent) {
      const { MailDeliveryError } = await import('@ad/mailer');
      throw new MailDeliveryError();
    }
    this.run(() => this.deps.mailer.sendEmailChangeNotice({ to: oldEmail }));
    await this.audit('auth.email_change_requested', 'success', meta, {
      accountId: actor.accountId,
      role: actor.role,
    });
    return { pendingEmail: target };
  }

  async confirmEmailChange(
    actor: Actor,
    input: { code: string },
    meta: RequestMeta,
  ): Promise<{ status: 'changed' } | { status: 'invalid' | 'expired' | 'too_many' }> {
    const check = await checkCode(this.deps.db, {
      accountId: actor.accountId,
      purpose: 'change_email',
      code: input.code,
      now: this.now(),
      ttlSeconds: this.cfg.emailChangeTtlSeconds,
      maxAttempts: this.cfg.verifyCodeMaxAttempts,
      pepper: this.deps.pepper,
    });
    if (check.status !== 'ok') return { status: check.status };
    const applied = await this.applyEmailChange(check.token, meta, {
      exceptSessionId: actor.sessionId,
    });
    return applied ? { status: 'changed' } : { status: 'invalid' };
  }

  /** M01-S05 edge: fix a typo in the address while the account is still unverified. */
  async changeUnverifiedEmail(
    input: { email: string; password: string; newEmail: string },
    meta: RequestMeta,
  ): Promise<{ email: string }> {
    const current = normalizeEmail(input.email);
    const target = normalizeEmail(input.newEmail);
    if (!target) throw new FieldErrors({ newEmail: 'Enter a valid email address' });
    if (!current) throw new InvalidCredentials();
    const hash = emailHash(current, this.deps.pepper);
    const ipKey = this.ipSubject(meta);
    await this.closed(() =>
      this.deps.limiter.enforce(RATE_POLICIES.verifyResendAccount, this.subject('mail', current)),
    );
    const lock = await this.closed(() => this.deps.lockouts.status(this.lockKey(hash)));
    if (lock.locked) throw new RateLimited(lock.retryAfterSeconds);
    const account = await findAccountByEmailHash(this.deps.db, hash);
    const own = account ? await this.loadOwn(account.id) : null;
    const ok = Boolean(
      account?.passwordHash &&
      own &&
      own.emailVerifiedAt === null &&
      account.status === 'active' &&
      (await this.deps.hasher.verify(account.passwordHash, input.password)),
    );
    if (!ok || !account) {
      await this.deps.hasher.verifyDummy(input.password);
      await this.loginFailed(current, hash, account?.id ?? null, meta, ipKey);
      throw new InvalidCredentials();
    }
    const targetHash = emailHash(target, this.deps.pepper);
    if (await findAccountByEmailHash(this.deps.db, targetHash)) {
      await this.deps.mailer.sendAlreadyRegistered({ to: target }).catch(() => undefined);
      return { email: target };
    }
    const now = this.now();
    await withAccount(this.deps.db, { accountId: account.id, role: account.role }, async (tx) => {
      await tx
        .update(schema.accounts)
        .set({
          emailHash: Buffer.from(targetHash),
          emailEnc: await this.deps.keys.seal(account.id, 'email', target),
        })
        .where(eq(schema.accounts.id, account.id));
    });
    await voidEmailTokens(this.deps.db, account.id, 'verify_email', now);
    await this.sendNewVerification(account.id, target, meta, true);
    await this.audit('auth.email_changed', 'success', meta, {
      accountId: account.id,
      role: account.role,
      metadata: { unverified: true },
    });
    return { email: target };
  }

  /**
   * Requests deletion (M02-S06, D-092). The account moves to pending_deletion, every session ends and a mail
   * with the purge date goes out. Nothing is removed until the grace period ends: signing in and cancelling
   * restores it as it was. `purgeDueDeletions` finishes the job.
   */
  async deleteAccount(
    actor: Actor,
    input: { password: string; confirmation: string },
    meta: RequestMeta,
  ): Promise<{ purgeAfter: Date }> {
    if (input.confirmation !== 'DELETE') {
      throw new FieldErrors({ confirmation: 'Type DELETE in capital letters to confirm' });
    }
    const confirmed = await this.confirmPassword(
      actor,
      input.password,
      meta,
      'password',
      'Password is not right',
    );
    const email = await confirmed.email();
    const now = this.now();
    const purgeAfter = new Date(now.getTime() + this.deletionGraceDays() * 86400_000);
    try {
      await withAccount(
        this.deps.db,
        { accountId: actor.accountId, role: actor.role },
        async (tx) => {
          await tx.delete(schema.sessions).where(eq(schema.sessions.accountId, actor.accountId));
          await tx
            .update(schema.accounts)
            .set({ status: 'pending_deletion' })
            .where(
              and(eq(schema.accounts.id, actor.accountId), eq(schema.accounts.status, 'active')),
            );
          await tx
            .insert(schema.accountDeletions)
            .values({ accountId: actor.accountId, requestedAt: now, purgeAfter })
            .onConflictDoUpdate({
              target: schema.accountDeletions.accountId,
              set: { requestedAt: now, purgeAfter },
            });
        },
      );
    } catch (error) {
      if (
        (error as { cause?: { code?: string }; code?: string }).code === '23514' ||
        (error as { cause?: { code?: string } }).cause?.code === '23514'
      ) {
        throw new Conflict(
          actor.role === 'super_admin'
            ? 'There must be at least one Super admin'
            : 'There must be at least one active admin',
        );
      }
      throw error;
    }
    await this.audit('account.deletion_requested', 'success', meta, {
      metadata: { subject: this.subject_(actor.accountId) },
    });
    this.run(() =>
      this.deps.mailer.sendDeletionScheduled({
        to: email,
        purgeDate: formatDate(purgeAfter),
        days: this.deletionGraceDays(),
      }),
    );
    return { purgeAfter };
  }

  /** What the cancel screen shows: whether a deletion is pending and when it happens. */
  async getDeletionState(
    actor: Actor,
  ): Promise<{ pending: false } | { pending: true; purgeAfter: Date }> {
    return withAccount(
      this.deps.db,
      { accountId: actor.accountId, role: actor.role },
      async (tx) => {
        const [row] = await tx
          .select({
            status: schema.accounts.status,
            purgeAfter: schema.accountDeletions.purgeAfter,
          })
          .from(schema.accounts)
          .leftJoin(
            schema.accountDeletions,
            eq(schema.accountDeletions.accountId, schema.accounts.id),
          )
          .where(eq(schema.accounts.id, actor.accountId));
        if (row?.status !== 'pending_deletion' || !row.purgeAfter)
          return { pending: false as const };
        return { pending: true as const, purgeAfter: row.purgeAfter };
      },
    );
  }

  /** M02-S06 AC2: the owner, signed in during the grace period, makes the account active again. */
  async cancelDeletion(actor: Actor, meta: RequestMeta): Promise<void> {
    const restored = await withAccount(
      this.deps.db,
      { accountId: actor.accountId, role: actor.role },
      async (tx) => {
        const rows = await tx
          .update(schema.accounts)
          .set({ status: 'active' })
          .where(
            and(
              eq(schema.accounts.id, actor.accountId),
              eq(schema.accounts.status, 'pending_deletion'),
            ),
          )
          .returning({ id: schema.accounts.id });
        if (rows.length === 0) return false;
        await tx
          .delete(schema.accountDeletions)
          .where(eq(schema.accountDeletions.accountId, actor.accountId));
        return true;
      },
    );
    if (!restored) throw new Conflict('This account is not waiting to be deleted');
    await this.audit('account.deletion_cancelled', 'success', meta, {
      accountId: actor.accountId,
      role: actor.role,
    });
  }

  /**
   * The scheduled purge (M32-S03). Removes every account whose grace period is over: personal data in one
   * transaction, then the key (crypto shredding), then the final mail. A failed key destruction leaves the row
   * for `destroyPendingKeys`. Returns how many accounts it purged.
   */
  async purgeDueDeletions(): Promise<number> {
    const now = this.now();
    const due = await this.deps.db
      .select({ accountId: schema.accountDeletions.accountId })
      .from(schema.accountDeletions)
      .where(
        and(
          isNull(schema.accountDeletions.mainDataPurgedAt),
          lte(schema.accountDeletions.purgeAfter, now),
        ),
      );
    let purged = 0;
    for (const { accountId } of due) {
      try {
        if (await this.purgeOne(accountId, now)) purged++;
      } catch (error) {
        this.logger.error('account purge failed, will retry', { error: String(error) });
      }
    }
    return purged;
  }

  private async purgeOne(accountId: string, now: Date): Promise<boolean> {
    const done = await withAccount(this.deps.db, { accountId, role: 'viewer' }, async (tx) => {
      const [account] = await tx
        .select({ status: schema.accounts.status, emailEnc: schema.accounts.emailEnc })
        .from(schema.accounts)
        .where(eq(schema.accounts.id, accountId))
        .for('update');
      if (account?.status !== 'pending_deletion') return null;
      await tx.delete(schema.profiles).where(eq(schema.profiles.accountId, accountId));
      await tx.delete(schema.sessions).where(eq(schema.sessions.accountId, accountId));
      await tx.delete(schema.emailTokens).where(eq(schema.emailTokens.accountId, accountId));
      await tx.delete(schema.consents).where(eq(schema.consents.accountId, accountId));
      await tx.delete(schema.dataExports).where(eq(schema.dataExports.accountId, accountId));
      await tx.delete(schema.mfaFactors).where(eq(schema.mfaFactors.accountId, accountId));
      await tx
        .delete(schema.mfaRecoveryCodes)
        .where(eq(schema.mfaRecoveryCodes.accountId, accountId));
      await tx
        .update(schema.accounts)
        .set({
          status: 'deleted',
          deletedAt: now,
          emailHash: null,
          emailEnc: null,
          displayNameEnc: null,
          passwordHash: null,
        })
        .where(eq(schema.accounts.id, accountId));
      await tx
        .update(schema.accountDeletions)
        .set({
          mainDataPurgedAt: now,
          backupsClearAfter: new Date(now.getTime() + this.deletionGraceDays() * 86400_000),
        })
        .where(eq(schema.accountDeletions.accountId, accountId));
      return account.emailEnc;
    });
    if (done === null) return false;
    // The address is read before the key goes, because afterwards no one can open it.
    let email: string | null = null;
    try {
      email = done ? await this.deps.keys.open(accountId, 'email', done) : null;
    } catch (error) {
      this.logger.error('could not read the address for the final notice', {
        error: String(error),
      });
    }
    await this.shredKey(accountId);
    await this.audit('account.deleted', 'success', NO_META, {
      metadata: { subject: this.subject_(accountId) },
    });
    if (email) {
      const to = email;
      this.run(() => this.deps.mailer.sendAccountDeleted({ to }));
    }
    return true;
  }

  protected deletionGraceDays(): number {
    return this.cfg.deletionGraceDays;
  }

  private subject_(accountId: string): string {
    return Buffer.from(sha256(accountId)).toString('hex').slice(0, 24);
  }

  private async shredKey(accountId: string): Promise<boolean> {
    try {
      await this.deps.keys.destroy(accountId);
      await this.deps.db
        .update(schema.accountDeletions)
        .set({ dekDestroyedAt: this.now() })
        .where(eq(schema.accountDeletions.accountId, accountId));
      return true;
    } catch (error) {
      this.logger.error('key destruction failed, will retry', { error: String(error) });
      return false;
    }
  }

  /** The retry job: destroys the key of every deleted account that still has one. Returns how many it finished. */
  async destroyPendingKeys(): Promise<number> {
    const pending = await this.deps.db
      .select({ accountId: schema.accountDeletions.accountId })
      .from(schema.accountDeletions)
      .where(
        and(
          isNull(schema.accountDeletions.dekDestroyedAt),
          isNotNull(schema.accountDeletions.mainDataPurgedAt),
        ),
      );
    let finished = 0;
    for (const row of pending) {
      if (await this.shredKey(row.accountId)) finished++;
    }
    return finished;
  }

  /** Display helper for the verify screen. */
  maskedEmail(email: string): string {
    return maskEmail(email);
  }
}
