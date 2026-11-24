import { schema, withAccount, type Database } from '@ad/db';
import { LimiterUnavailable, LOCKOUT_POLICIES, RATE_POLICIES } from '@ad/security';
import { isStaffRole, NotFound, RateLimited, uuidv7 } from '@ad/shared';
import { and, eq, sql } from 'drizzle-orm';
import { voidEmailTokens } from '../email-tokens';
import { emailHash, maskEmail, normalizeEmail } from '../identifiers';
import { isUniqueViolation } from '../lookup';
import { ViewerMfaService, type ViewerMfaSignIn } from '../viewer-mfa';
import {
  FieldErrors,
  InvalidCredentials,
  type Actor,
  type AuthDeps,
  type RequestMeta,
} from '../types';
import { type GoogleClient, GoogleOAuthError, newOAuthParams, type GoogleProfile } from './google';
import { decideLink, type LinkAccountFacts } from './link-rules';
import { readNote, signNote } from './note';

type DbTx = Parameters<Parameters<Database['transaction']>[0]>[0];

/** How long the state cookie and the two confirmation notes live. */
export const OAUTH_NOTE_SECONDS = 600;
const DEFAULT_NEXT = '/profiles';

/** A local path only. Anything with a scheme, host or backslash tricks falls back to the profile picker. */
export function safeNext(next: string | null | undefined): string {
  if (!next || next.length > 512 || !next.startsWith('/') || next.startsWith('//'))
    return DEFAULT_NEXT;
  if (/[\\\u0000-\u001f]/.test(next)) return DEFAULT_NEXT;
  return next;
}

interface Carry {
  next: string;
  /** The browser has guest progress, so the same import prompt as after a password sign in follows. */
  importGuest: boolean;
}

type SessionOutcome = Carry & (ViewerMfaSignIn extends infer S ? S : never) & { created: boolean };

export type GoogleOutcome =
  | SessionOutcome
  | (Carry & { status: 'mfa_required'; accountId: string; pendingToken: string })
  | (Carry & { status: 'confirm_link'; pendingToken: string })
  | (Carry & { status: 'finish_signup'; pendingToken: string; hint: string })
  | (Carry & { status: 'linked' })
  | { status: 'failed' };

export interface IdentityStatus {
  linked: boolean;
  /** A masked address such as j***@gmail.com. */
  hint: string | null;
  linkedAt: Date | null;
  hasPassword: boolean;
}

export interface GoogleAuthOptions {
  client: GoogleClient;
}

type CookiePayload = {
  state: string;
  nonce: string;
  verifier: string;
  next: string;
  imp: boolean;
  link: string | null;
};

type LinkNote = {
  accountId: string;
  sub: string;
  h: string;
  hint: string;
  next: string;
  imp: boolean;
};

type SignupNote = { sub: string; email: string; next: string; imp: boolean };

interface AccountFacts extends LinkAccountFacts {
  emailHash: Uint8Array | null;
}

/**
 * Optional Google sign in (M49-S05 to S07). One service owns the whole flow: the authorization start, the
 * callback checks, the linking rules and the unlink. It extends the viewer service so the account, session,
 * two step and login history rules are the same ones a password sign in uses.
 */
export class GoogleAuthService extends ViewerMfaService {
  constructor(
    deps: AuthDeps,
    private readonly google: GoogleAuthOptions,
  ) {
    super(deps);
  }

  private note(purpose: string, payload: Record<string, unknown>): string {
    return signNote(this.deps.pepper, purpose, payload, OAUTH_NOTE_SECONDS, this.now().getTime());
  }

  private readNoteOf<T extends Record<string, unknown>>(
    purpose: string,
    token: string | null | undefined,
  ) {
    return readNote<T>(this.deps.pepper, purpose, token, this.now().getTime());
  }

  private async deny(
    reason: string,
    meta: RequestMeta,
    extra: { accountId?: string; role?: string } = {},
  ): Promise<{ status: 'failed' }> {
    await this.audit('viewer.google_signin', 'denied', meta, {
      accountId: extra.accountId ?? null,
      role: extra.role ?? null,
      metadata: { reason },
    });
    return { status: 'failed' };
  }

  /** What a confirmation screen may show from the note: which step it is and a masked address. */
  peekNote(token: string | null | undefined): { kind: 'link' | 'signup'; hint: string } | null {
    const link = this.readNoteOf<LinkNote & Record<string, unknown>>('glink', token);
    if (link) return { kind: 'link', hint: link.hint };
    const signup = this.readNoteOf<SignupNote & Record<string, unknown>>('gsignup', token);
    return signup ? { kind: 'signup', hint: maskEmail(signup.email) } : null;
  }

  // -----------------------------------------------------------------------------------------------
  // Start and callback
  // -----------------------------------------------------------------------------------------------

  /** The address to send the browser to, and the signed cookie value that holds state, nonce and verifier. */
  async begin(
    input: { next?: string | null; importGuest?: boolean; linkAccountId?: string },
    meta: RequestMeta,
  ): Promise<{ url: string; cookie: string; maxAge: number }> {
    await this.deps.limiter.enforce(RATE_POLICIES.googleStartIp, this.ipSubject(meta));
    const params = newOAuthParams();
    const payload: CookiePayload = {
      state: params.state,
      nonce: params.nonce,
      verifier: params.verifier,
      next: safeNext(input.next),
      imp: input.importGuest === true,
      link: input.linkAccountId ?? null,
    };
    return {
      url: this.google.client.authorizationUrl(params),
      cookie: this.note('oauth', payload),
      maxAge: OAUTH_NOTE_SECONDS,
    };
  }

  /**
   * What comes back from Google. Every failure is `{ status: 'failed' }`: the person sees one generic page, and
   * the reason goes to the audit log only. `actor` is the signed in person when this was a Connect request.
   */
  async complete(
    input: { code?: string | null; state?: string | null; error?: string | null },
    cookie: string | null | undefined,
    meta: RequestMeta,
    actor: Actor | null,
  ): Promise<GoogleOutcome> {
    try {
      await this.closed(() =>
        this.deps.limiter.enforce(RATE_POLICIES.googleCallbackIp, this.ipSubject(meta)),
      );
    } catch (error) {
      if (error instanceof RateLimited || error instanceof LimiterUnavailable)
        return this.deny('rate_limited', meta);
      throw error;
    }
    const note = this.readNoteOf<CookiePayload & Record<string, unknown>>('oauth', cookie);
    if (!note) return this.deny('state_cookie', meta);
    if (input.error) return this.deny('provider_error', meta);
    const given = Buffer.from(input.state ?? '');
    const wanted = Buffer.from(note.state);
    if (!input.code || given.length !== wanted.length || !timingSafeEqualBuffers(given, wanted))
      return this.deny('state_mismatch', meta);

    let profile: GoogleProfile;
    try {
      profile = await this.google.client.exchange({
        code: input.code,
        codeVerifier: note.verifier,
        nonce: note.nonce,
      });
    } catch (error) {
      if (error instanceof GoogleOAuthError) return this.deny(error.reason, meta);
      throw error;
    }
    const carry: Carry = { next: safeNext(note.next), importGuest: note.imp === true };
    if (note.link) return this.completeConnect(note.link, actor, profile, carry, meta);
    return this.completeSignIn_(profile, carry, meta);
  }

  // -----------------------------------------------------------------------------------------------
  // Facts and the decision
  // -----------------------------------------------------------------------------------------------

  private async factsOf(accountId: string): Promise<AccountFacts | null> {
    const row = await this.loadOwn(accountId);
    if (!row) return null;
    return {
      id: row.id,
      role: row.role,
      status: row.status,
      verified: row.emailVerifiedAt !== null,
      hasPassword: row.passwordHash !== null,
      emailHash: row.emailHash ? new Uint8Array(row.emailHash) : null,
    };
  }

  private async identityOwner(sub: string): Promise<string | null> {
    const result = await this.deps.db.execute<{ account_id: string } & Record<string, unknown>>(
      sql`SELECT * FROM auth_find_identity('google', ${sub})`,
    );
    return result.rows[0]?.account_id ?? null;
  }

  private async accountByEmail(hash: Uint8Array): Promise<LinkAccountFacts | null> {
    const result = await this.deps.db.execute<
      {
        id: string;
        has_password: boolean;
        status: string;
        role: string;
        email_verified_at: Date | null;
      } & Record<string, unknown>
    >(sql`SELECT * FROM auth_find_account_for_link(${Buffer.from(hash)})`);
    const row = result.rows[0];
    return row
      ? {
          id: row.id,
          role: row.role,
          status: row.status,
          verified: row.email_verified_at !== null,
          hasPassword: row.has_password,
        }
      : null;
  }

  private async completeSignIn_(
    profile: GoogleProfile,
    carry: Carry,
    meta: RequestMeta,
  ): Promise<GoogleOutcome> {
    const email = normalizeEmail(profile.email);
    if (!email) return this.deny('email', meta);
    const hash = emailHash(email, this.deps.pepper);
    const ownerId = await this.identityOwner(profile.sub);
    const owner = ownerId ? await this.factsOf(ownerId) : null;
    const decision = decideLink({
      emailVerified: profile.emailVerified,
      identity: owner ? { account: owner } : null,
      account: owner ? null : await this.accountByEmail(hash),
    });

    switch (decision.action) {
      case 'refuse': {
        // Staff and suspended attempts name the account in the audit entry, so they can be followed up.
        const target = owner ?? (await this.accountByEmail(hash));
        return this.deny(decision.reason, meta, {
          accountId: decision.reason === 'unverified_email' ? undefined : target?.id,
          role: decision.reason === 'unverified_email' ? undefined : target?.role,
        });
      }
      case 'sign_in':
        return this.signInTo(decision.accountId, carry, meta, { touchSub: profile.sub });
      case 'adopt':
        return this.adopt(decision.accountId, profile, hash, email, carry, meta);
      case 'confirm_link': {
        if (decision.proof === 'reset')
          return this.deny('no_password_to_confirm', meta, { accountId: decision.accountId });
        const pending: LinkNote = {
          accountId: decision.accountId,
          sub: profile.sub,
          h: Buffer.from(hash).toString('hex'),
          hint: maskEmail(email),
          next: carry.next,
          imp: carry.importGuest,
        };
        return { status: 'confirm_link', pendingToken: this.note('glink', pending), ...carry };
      }
      case 'create': {
        const { open } = await (this.deps.signUpPolicy?.() ?? { open: this.cfg.signUpOpen });
        if (!open) return this.deny('signup_closed', meta);
        const pending: SignupNote = {
          sub: profile.sub,
          email,
          next: carry.next,
          imp: carry.importGuest,
        };
        return {
          status: 'finish_signup',
          pendingToken: this.note('gsignup', pending),
          hint: maskEmail(email),
          ...carry,
        };
      }
    }
  }

  // -----------------------------------------------------------------------------------------------
  // Acting on the decision
  // -----------------------------------------------------------------------------------------------

  /** Signs the account in through the same door as a password: the second step first when it is on. */
  private async signInTo(
    accountId: string,
    carry: Carry,
    meta: RequestMeta,
    options: { touchSub?: string; created?: boolean } = {},
  ): Promise<GoogleOutcome> {
    if (options.touchSub) {
      await withAccount(this.deps.db, { accountId, role: 'viewer' }, (tx) =>
        tx
          .update(schema.accountIdentities)
          .set({ lastUsedAt: this.now() })
          .where(
            and(
              eq(schema.accountIdentities.accountId, accountId),
              eq(schema.accountIdentities.subject, options.touchSub!),
            ),
          ),
      );
    }
    const challenge = await this.mfaChallenge(accountId);
    if (challenge) {
      await this.audit('viewer.google_signin', 'success', meta, {
        accountId,
        role: 'viewer',
        metadata: { mfa: true },
      });
      return { status: 'mfa_required', accountId, pendingToken: challenge, ...carry };
    }
    const opened = await this.openSession(accountId, meta);
    await this.audit('viewer.google_signin', 'success', meta, {
      accountId,
      role: 'viewer',
      metadata: options.created ? { created: true } : undefined,
    });
    return { ...opened, ...carry, created: options.created === true };
  }

  private async insertIdentity(
    tx: DbTx,
    accountId: string,
    profile: { sub: string },
    hash: Uint8Array,
    hint: string,
  ): Promise<void> {
    await tx.insert(schema.accountIdentities).values({
      accountId,
      provider: 'google',
      subject: profile.sub,
      emailHash: Buffer.from(hash),
      emailHint: hint,
      lastUsedAt: this.now(),
    });
  }

  /** Rule 5: Google proves the address, so an unverified account is taken over and the old password dies. */
  private async adopt(
    accountId: string,
    profile: GoogleProfile,
    hash: Uint8Array,
    email: string,
    carry: Carry,
    meta: RequestMeta,
  ): Promise<GoogleOutcome> {
    const now = this.now();
    try {
      await withAccount(this.deps.db, { accountId, role: 'viewer' }, async (tx) => {
        await tx
          .update(schema.accounts)
          .set({ passwordHash: null, emailVerifiedAt: now, passwordChangedAt: now })
          .where(eq(schema.accounts.id, accountId));
        await this.insertIdentity(tx, accountId, profile, hash, maskEmail(email));
      });
    } catch (error) {
      if (isUniqueViolation(error)) return this.deny('identity_taken', meta, { accountId });
      throw error;
    }
    await voidEmailTokens(this.deps.db, accountId, 'verify_email', now);
    await this.deps.sessions.revokeAll(accountId);
    await this.audit('viewer.google_linked', 'success', meta, {
      accountId,
      role: 'viewer',
      metadata: { adopted: true },
    });
    await this.mailTo(accountId, (to) => this.deps.mailer.sendGoogleLinked({ to }));
    return this.signInTo(accountId, carry, meta);
  }

  /** The "Finish setting up" step for a brand new Google account: terms and age consent, then the account. */
  async finishSignUp(
    pendingToken: string,
    input: { acceptTerms: boolean; guardianDeclaration: boolean },
    meta: RequestMeta,
  ): Promise<GoogleOutcome> {
    const note = this.readNoteOf<SignupNote & Record<string, unknown>>('gsignup', pendingToken);
    if (!note) throw new InvalidCredentials();
    const fields: Record<string, string> = {};
    if (!input.acceptTerms) fields.acceptTerms = 'Accept the terms to continue';
    if (!input.guardianDeclaration)
      fields.guardianDeclaration = 'Confirm you are an adult or a guardian';
    if (Object.keys(fields).length > 0) throw new FieldErrors(fields);
    await this.deps.limiter.enforce(RATE_POLICIES.signupIp, this.ipSubject(meta));
    const { open } = await (this.deps.signUpPolicy?.() ?? { open: this.cfg.signUpOpen });
    if (!open) throw new InvalidCredentials();

    const hash = emailHash(note.email, this.deps.pepper);
    // Facts may have changed since the callback. Only a still unclaimed address and identity may be created.
    const decision = decideLink({
      emailVerified: true,
      identity: await this.identityOwner(note.sub).then(async (id) => {
        const facts = id ? await this.factsOf(id) : null;
        return facts ? { account: facts } : null;
      }),
      account: await this.accountByEmail(hash),
    });
    if (decision.action !== 'create') throw new InvalidCredentials();

    const accountId = uuidv7();
    const now = this.now();
    await this.deps.keys.createForAccount(accountId);
    try {
      const emailEnc = await this.deps.keys.seal(accountId, 'email', note.email);
      await withAccount(this.deps.db, { accountId, role: 'viewer' }, async (tx) => {
        await tx.insert(schema.accounts).values({
          id: accountId,
          emailHash: Buffer.from(hash),
          emailEnc,
          passwordHash: null,
          emailVerifiedAt: now,
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
        await this.insertIdentity(tx, accountId, { sub: note.sub }, hash, maskEmail(note.email));
      });
    } catch (error) {
      await this.deps.keys.destroy(accountId).catch(() => undefined);
      if (isUniqueViolation(error)) throw new InvalidCredentials();
      throw error;
    }
    await this.audit('auth.signup', 'success', meta, {
      accountId,
      role: 'viewer',
      metadata: { method: 'google' },
    });
    this.run(() => this.deps.mailer.sendWelcome({ to: note.email }));
    return this.signInTo(
      accountId,
      { next: safeNext(note.next), importGuest: note.imp === true },
      meta,
      {
        created: true,
      },
    );
  }

  /**
   * Rule 4: a verified password account is linked only after the password is given once. Wrong passwords count
   * toward the same lockout as sign in.
   */
  async confirmLink(
    pendingToken: string,
    input: { password: string },
    meta: RequestMeta,
  ): Promise<GoogleOutcome> {
    const note = this.readNoteOf<LinkNote & Record<string, unknown>>('glink', pendingToken);
    if (!note) throw new InvalidCredentials();
    const account = await this.loadOwn(note.accountId);
    if (
      !account ||
      account.status !== 'active' ||
      isStaffRole(account.role) ||
      !account.emailEnc ||
      !account.emailHash ||
      !account.passwordHash
    ) {
      throw new InvalidCredentials();
    }
    const ipKey = this.ipSubject(meta);
    const ip = await this.closed(() => this.deps.limiter.peek(RATE_POLICIES.loginIp, ipKey));
    if (!ip.allowed) throw new RateLimited(ip.retryAfterSeconds);
    const lockKey = this.lockKey(account.emailHash);
    const lock = await this.closed(() => this.deps.lockouts.status(lockKey));
    if (lock.locked) throw new RateLimited(lock.retryAfterSeconds);
    if (!(await this.deps.hasher.verify(account.passwordHash, input.password))) {
      const email = await this.deps.keys.open(account.id, 'email', account.emailEnc);
      await this.closed(() => this.deps.limiter.consume(RATE_POLICIES.loginIp, ipKey));
      await this.audit('viewer.google_linked', 'failure', meta, {
        accountId: account.id,
        role: account.role,
      });
      await this.recordLogin(account.id, 'viewer', 'failed', meta);
      await this.registerAccountFailure(
        account.emailHash,
        account.id,
        email,
        meta,
        LOCKOUT_POLICIES.viewerLogin,
      );
      throw new FieldErrors({ password: 'Password is not right' });
    }
    await this.closed(() => this.deps.lockouts.clear(lockKey));
    try {
      await withAccount(this.deps.db, { accountId: account.id, role: account.role }, (tx) =>
        this.insertIdentity(
          tx,
          account.id,
          { sub: note.sub },
          Buffer.from(note.h, 'hex'),
          note.hint,
        ),
      );
    } catch (error) {
      if (isUniqueViolation(error)) throw new InvalidCredentials();
      throw error;
    }
    await this.audit('viewer.google_linked', 'success', meta, {
      accountId: account.id,
      role: 'viewer',
    });
    await this.mailTo(account.id, (to) => this.deps.mailer.sendGoogleLinked({ to }));
    return this.signInTo(
      account.id,
      { next: safeNext(note.next), importGuest: note.imp === true },
      meta,
    );
  }

  // -----------------------------------------------------------------------------------------------
  // Connect and unlink from the Security screen (M49-S06)
  // -----------------------------------------------------------------------------------------------

  private async completeConnect(
    accountId: string,
    actor: Actor | null,
    profile: GoogleProfile,
    carry: Carry,
    meta: RequestMeta,
  ): Promise<GoogleOutcome> {
    if (!actor || actor.accountId !== accountId) return this.deny('connect_session', meta);
    const email = normalizeEmail(profile.email);
    if (!email || !profile.emailVerified) return this.deny('unverified_email', meta, { accountId });
    const account = await this.factsOf(accountId);
    if (!account || account.status !== 'active' || isStaffRole(account.role as never))
      return this.deny('connect_account', meta, { accountId });
    const owner = await this.identityOwner(profile.sub);
    if (owner && owner !== accountId) return this.deny('identity_taken', meta, { accountId });
    if (!owner) {
      try {
        await withAccount(this.deps.db, { accountId, role: 'viewer' }, (tx) =>
          this.insertIdentity(
            tx,
            accountId,
            profile,
            emailHash(email, this.deps.pepper),
            maskEmail(email),
          ),
        );
      } catch (error) {
        if (isUniqueViolation(error)) return this.deny('identity_taken', meta, { accountId });
        throw error;
      }
      await this.audit('viewer.google_linked', 'success', meta, { accountId, role: 'viewer' });
      await this.mailTo(accountId, (to) => this.deps.mailer.sendGoogleLinked({ to }));
    }
    return { status: 'linked', ...carry };
  }

  async identityStatus(actor: Actor): Promise<IdentityStatus> {
    return withAccount(this.deps.db, { accountId: actor.accountId, role: 'viewer' }, async (tx) => {
      const [identity] = await tx
        .select({
          hint: schema.accountIdentities.emailHint,
          linkedAt: schema.accountIdentities.linkedAt,
        })
        .from(schema.accountIdentities)
        .where(eq(schema.accountIdentities.provider, 'google'));
      const [account] = await tx
        .select({ passwordHash: schema.accounts.passwordHash })
        .from(schema.accounts)
        .where(eq(schema.accounts.id, actor.accountId));
      return {
        linked: Boolean(identity),
        hint: identity?.hint ?? null,
        linkedAt: identity?.linkedAt ?? null,
        hasPassword: account?.passwordHash != null,
      };
    });
  }

  /** M49-S06 AC4: Google can go only when another way in is left, and the password is asked once. */
  async unlink(actor: Actor, input: { password: string }, meta: RequestMeta): Promise<void> {
    const status = await this.identityStatus(actor);
    if (!status.linked) throw new NotFound();
    if (!status.hasPassword) throw new FieldErrors({ password: 'Set a password first' });
    await this.confirmPassword(actor, input.password, meta, 'password', 'Password is not right');
    await withAccount(this.deps.db, { accountId: actor.accountId, role: 'viewer' }, (tx) =>
      tx.delete(schema.accountIdentities).where(eq(schema.accountIdentities.provider, 'google')),
    );
    await this.audit('viewer.google_unlinked', 'success', meta, {
      accountId: actor.accountId,
      role: 'viewer',
    });
    await this.mailTo(actor.accountId, (to) => this.deps.mailer.sendGoogleUnlinked({ to }));
  }
}

function timingSafeEqualBuffers(a: Buffer, b: Buffer): boolean {
  // Lengths are equal here. A plain loop keeps this free of a node:crypto import in the web bundle.
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!;
  return diff === 0;
}
