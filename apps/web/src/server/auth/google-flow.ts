import {
  type Actor,
  type GoogleAuthService,
  type GoogleOutcome,
  FieldErrors,
  InvalidCredentials,
  OAUTH_NOTE_SECONDS,
  type RequestMeta,
} from '@ad/auth';
import { RateLimited } from '@ad/shared';
import { safeViewerNext } from './next-param';

/** The request bound pieces of the Google flow. Real cookies and headers in the app, fakes in tests. */
export interface GoogleIo {
  meta(): Promise<RequestMeta>;
  currentActor(): Promise<Actor | null>;
  setSession(token: string, kind: 'viewer'): Promise<void>;
  setTwoStepPending(token: string): Promise<void>;
  /** The signed state cookie for one trip to Google. */
  setState(value: string, maxAge: number): Promise<void>;
  readState(): Promise<string | undefined>;
  clearState(): Promise<void>;
  /** The signed note between the callback and the link confirmation or consent screen. */
  setNote(value: string, maxAge: number): Promise<void>;
  readNote(): Promise<string | undefined>;
  clearNote(): Promise<void>;
}

type Service = Pick<
  GoogleAuthService,
  'begin' | 'complete' | 'confirmLink' | 'finishSignUp' | 'unlink' | 'identityStatus' | 'peekNote'
>;

export const GOOGLE_FAILED_PATH = '/sign-in/google-failed';
const minutes = (seconds: number) => Math.max(1, Math.ceil(seconds / 60));

export type StartResult =
  | { kind: 'redirect'; url: string }
  | { kind: 'not_found' }
  | { kind: 'sign_in' }
  | { kind: 'failed' };

export type ConfirmResult =
  | { ok: true; next: string }
  | { ok: false; reason: 'wrong' | 'expired' | 'network' }
  | { ok: false; reason: 'locked'; minutes: number };

export type FinishResult =
  | { ok: true; next: string }
  | { ok: false; reason: 'expired' | 'network' }
  | { ok: false; reason: 'fields'; fields: Record<string, string> }
  | { ok: false; reason: 'locked'; minutes: number };

/**
 * The browser side of Google sign in: what the start and callback routes and the two confirmation screens do
 * with cookies and redirects. All decisions live in `GoogleAuthService`. Every failure ends on one generic page.
 */
export class GoogleFlow {
  constructor(
    private readonly service: Service,
    private readonly io: GoogleIo,
    /** Keys are set and the site setting is on. Read at each request so an admin change applies at once. */
    private readonly enabled: () => Promise<boolean>,
  ) {}

  async available(): Promise<boolean> {
    return this.enabled();
  }

  async start(input: { next?: string; link?: boolean }): Promise<StartResult> {
    if (!(await this.enabled())) return { kind: 'not_found' };
    let linkAccountId: string | undefined;
    if (input.link) {
      const actor = await this.io.currentActor();
      if (!actor) return { kind: 'sign_in' };
      linkAccountId = actor.accountId;
    }
    try {
      const begin = await this.service.begin(
        {
          next: input.link ? '/account/security' : safeViewerNext(input.next),
          linkAccountId,
        },
        await this.io.meta(),
      );
      await this.io.setState(begin.cookie, begin.maxAge);
      return { kind: 'redirect', url: begin.url };
    } catch (error) {
      if (error instanceof RateLimited) return { kind: 'failed' };
      throw error;
    }
  }

  async callback(params: {
    code?: string | null;
    state?: string | null;
    error?: string | null;
  }): Promise<{ redirect: string }> {
    const cookie = await this.io.readState();
    // One try per cookie: it is removed whatever the outcome.
    await this.io.clearState();
    const outcome = await this.service.complete(
      {
        code: params.code ?? undefined,
        state: params.state ?? undefined,
        error: params.error ?? undefined,
      },
      cookie,
      await this.io.meta(),
      await this.io.currentActor(),
    );
    return { redirect: await this.land(outcome) };
  }

  private async land(outcome: GoogleOutcome): Promise<string> {
    switch (outcome.status) {
      case 'failed':
        return GOOGLE_FAILED_PATH;
      case 'signed_in':
        await this.io.setSession(outcome.session.token, 'viewer');
        return safeViewerNext(outcome.next);
      case 'pending_deletion':
        await this.io.setSession(outcome.session.token, 'viewer');
        return '/account/deletion';
      case 'mfa_required': {
        await this.io.setTwoStepPending(outcome.pendingToken);
        const next = safeViewerNext(outcome.next);
        return next !== '/profiles'
          ? `/sign-in/verify?next=${encodeURIComponent(next)}`
          : '/sign-in/verify';
      }
      case 'finish_signup':
        await this.io.setNote(outcome.pendingToken, OAUTH_NOTE_SECONDS);
        return '/sign-up/google';
      case 'confirm_link':
        await this.io.setNote(outcome.pendingToken, OAUTH_NOTE_SECONDS);
        return '/sign-in/link-google';
      case 'linked':
        return '/account/security?notice=google';
    }
  }

  /** For the two confirmation screens: which step the note is for and a masked address, or null. */
  async noteInfo(): Promise<{ kind: 'link' | 'signup'; hint: string } | null> {
    const note = await this.io.readNote();
    return note ? this.service.peekNote(note) : null;
  }

  /** The "Link Google to your account" step: the password, once. */
  async confirmLink(password: string): Promise<ConfirmResult> {
    const note = await this.io.readNote();
    if (!note) return { ok: false, reason: 'expired' };
    try {
      const outcome = await this.service.confirmLink(note, { password }, await this.io.meta());
      await this.io.clearNote();
      const next = await this.land(outcome);
      return { ok: true, next };
    } catch (error) {
      if (error instanceof RateLimited)
        return { ok: false, reason: 'locked', minutes: minutes(error.retryAfterSeconds) };
      if (error instanceof FieldErrors) return { ok: false, reason: 'wrong' };
      if (error instanceof InvalidCredentials) {
        await this.io.clearNote();
        return { ok: false, reason: 'expired' };
      }
      return { ok: false, reason: 'network' };
    }
  }

  /** The "Finish setting up" step for a new Google account: terms and age consent. */
  async finishSignUp(input: {
    acceptTerms: boolean;
    guardianDeclaration: boolean;
  }): Promise<FinishResult> {
    const note = await this.io.readNote();
    if (!note) return { ok: false, reason: 'expired' };
    try {
      const outcome = await this.service.finishSignUp(note, input, await this.io.meta());
      await this.io.clearNote();
      return { ok: true, next: await this.land(outcome) };
    } catch (error) {
      if (error instanceof RateLimited)
        return { ok: false, reason: 'locked', minutes: minutes(error.retryAfterSeconds) };
      if (error instanceof FieldErrors)
        return { ok: false, reason: 'fields', fields: error.fields };
      if (error instanceof InvalidCredentials) {
        await this.io.clearNote();
        return { ok: false, reason: 'expired' };
      }
      return { ok: false, reason: 'network' };
    }
  }

  /** What the Security card shows, or null when Google is off or nobody is signed in (the card is then absent). */
  async cardState(): Promise<{
    linked: boolean;
    hint: string | null;
    hasPassword: boolean;
  } | null> {
    if (!(await this.enabled())) return null;
    const actor = await this.io.currentActor();
    if (!actor) return null;
    const status = await this.service.identityStatus(actor);
    return { linked: status.linked, hint: status.hint, hasPassword: status.hasPassword };
  }

  /** Remove Google. Needs another way in, and the password once (M49-S06 AC4). */
  async unlink(
    password: string,
  ): Promise<
    | { ok: true }
    | { ok: false; reason: 'wrong_password' | 'set_password' | 'network' }
    | { ok: false; reason: 'locked'; minutes: number }
  > {
    const actor = await this.io.currentActor();
    if (!actor) return { ok: false, reason: 'network' };
    try {
      await this.service.unlink(actor, { password }, await this.io.meta());
      return { ok: true };
    } catch (error) {
      if (error instanceof RateLimited)
        return { ok: false, reason: 'locked', minutes: minutes(error.retryAfterSeconds) };
      if (error instanceof FieldErrors)
        return {
          ok: false,
          reason:
            error.fields.password === 'Set a password first' ? 'set_password' : 'wrong_password',
        };
      return { ok: false, reason: 'network' };
    }
  }
}
