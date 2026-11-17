import { schema, withAccount } from '@ad/db';
import { LimiterUnavailable, LOCKOUT_POLICIES, RATE_POLICIES } from '@ad/security';
import { hmacSha256, RateLimited, uuidv7 } from '@ad/shared';
import { and, eq, isNull } from 'drizzle-orm';
import { checkCode, findEmailToken, issueEmailToken, voidEmailTokens } from './email-tokens';
import { emailHash, maskEmail, normalizeEmail } from './identifiers';
import { findAccountByEmailHash, isUniqueViolation } from './lookup';
import { checkPassword } from './policy';
import {
  DEFAULT_AUTH_CONFIG,
  AccountUnavailable,
  FieldErrors,
  InvalidCredentials,
  SignUpClosed,
  TokenRejected,
  type Actor,
  type AuthConfig,
  type AuthDeps,
  type Logger,
  type RequestMeta,
} from './types';

export interface SignUpInput {
  email: string;
  password: string;
  acceptTerms: boolean;
  guardianDeclaration: boolean;
  /** Hidden form field real people never fill (M01-S14). Any value silently drops the submission. */
  website?: string;
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
    } = {},
  ): Promise<void> {
    await this.deps.audit.record({
      action,
      outcome,
      actorAccountId: extra.accountId ?? null,
      actorRole: extra.role ?? null,
      targetType: extra.accountId ? 'account' : null,
      targetId: extra.accountId ?? null,
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
    if (!this.cfg.signUpOpen) throw new SignUpClosed();
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

    // Hash first on every path so a new address and an existing one cost the same time.
    const passwordHash = await this.deps.hasher.hash(input.password);
    const hash = emailHash(email, this.deps.pepper);
    const existing = await findAccountByEmailHash(this.deps.db, hash);
    if (existing) return this.signUpExisting(email, meta);

    const accountId = uuidv7();
    const now = this.now();
    await this.deps.keys.createForAccount(accountId);
    let issued: { token: string; code: string | null };
    try {
      const emailEnc = await this.deps.keys.seal(accountId, 'email', email);
      issued = await withAccount(this.deps.db, { accountId, role: 'viewer' }, async (tx) => {
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
    await this.audit('auth.signup', 'success', meta, { accountId, role: 'viewer' });
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
    await this.audit('auth.verify_email', 'success', meta, {
      accountId: row.accountId,
      metadata: { method: 'link' },
    });
    return { status: 'verified', purpose: 'verify_email' };
  }

  /** Placeholder replaced by the account change slice. */
  protected async applyEmailChange(
    _row: NonNullable<Awaited<ReturnType<typeof findEmailToken>>>,
    _meta: RequestMeta,
  ): Promise<boolean> {
    return false;
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
    await this.closed(() => this.deps.lockouts.clear(this.lockKey(account.emailHash!)));
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
    const key = this.lockKey(account.emailHash);
    const lock = await this.closed(() => this.deps.lockouts.status(key));
    if (lock.locked) throw new RateLimited(lock.retryAfterSeconds);
    if (!(await this.deps.hasher.verify(account.passwordHash, password))) {
      const email = await this.deps.keys.open(account.id, 'email', account.emailEnc);
      await this.registerAccountFailure(account.emailHash, account.id, email, meta, policy);
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

  /** Confirms the password for a sensitive action and returns when it was confirmed. */
  async reauthenticate(actor: Actor, password: string, meta: RequestMeta): Promise<void> {
    await this.confirmPassword(actor, password, meta, 'password', 'Password is not right');
  }

  async changePassword(
    actor: Actor,
    input: { currentPassword: string; newPassword: string },
    meta: RequestMeta,
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
      kind: 'viewer',
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

  /** Display helper for the verify screen. */
  maskedEmail(email: string): string {
    return maskEmail(email);
  }
}
