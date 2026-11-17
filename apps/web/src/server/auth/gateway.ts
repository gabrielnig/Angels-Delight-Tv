import {
  type Actor,
  AccountUnavailable,
  type RequestMeta,
  type StaffService,
  FieldErrors,
  InvalidCredentials,
  TokenRejected,
} from '@ad/auth';
import { RateLimited } from '@ad/shared';
import type { AuthGateway } from '../../lib/data/types';
import type { SessionCookieKind } from './cookies';
import { safeViewerNext } from './next-param';

/** Everything the gateway needs from the request. Real cookies and headers in the app, fakes in tests. */
export interface GatewayIo {
  meta(): Promise<RequestMeta>;
  setSession(token: string, kind: SessionCookieKind): Promise<void>;
  clearSession(): Promise<void>;
  readSessionToken(): Promise<string | undefined>;
  currentActor(): Promise<Actor | null>;
  setPending(email: string): Promise<void>;
  readPending(): Promise<string | null>;
}

type Service = Pick<
  StaffService,
  | 'signIn'
  | 'signUp'
  | 'verifyCode'
  | 'verifyLink'
  | 'resendVerification'
  | 'requestPasswordReset'
  | 'resetPassword'
  | 'signOut'
  | 'reauthenticate'
  | 'triesLeft'
>;

const minutes = (seconds: number) => Math.max(1, Math.ceil(seconds / 60));

/** Real implementation of the viewer UI's AuthGateway on top of the auth services (modules M01 and M02). */
export class RealAuthGateway implements AuthGateway {
  constructor(
    private readonly service: Service,
    private readonly io: GatewayIo,
  ) {}

  async signIn(input: { email: string; password: string; next?: string }) {
    try {
      const result = await this.service.signIn(
        { email: input.email, password: input.password },
        await this.io.meta(),
      );
      if (result.status === 'needs_verification') {
        await this.io.setPending(result.email);
        return { ok: true as const, next: '/verify-email' };
      }
      await this.io.setSession(result.session.token, 'viewer');
      return { ok: true as const, next: safeViewerNext(input.next) };
    } catch (error) {
      if (error instanceof InvalidCredentials)
        return { ok: false as const, reason: 'invalid' as const };
      if (error instanceof FieldErrors) return { ok: false as const, reason: 'invalid' as const };
      if (error instanceof RateLimited) {
        return {
          ok: false as const,
          reason: 'locked' as const,
          minutes: minutes(error.retryAfterSeconds),
        };
      }
      if (error instanceof AccountUnavailable)
        return { ok: false as const, reason: 'unavailable' as const };
      return { ok: false as const, reason: 'network' as const };
    }
  }

  async signUp(input: { email: string; password: string }) {
    try {
      // The screen states that creating an account accepts the terms and confirms an adult or guardian.
      const result = await this.service.signUp(
        { ...input, acceptTerms: true, guardianDeclaration: true },
        await this.io.meta(),
      );
      await this.io.setPending(result.email);
      return { ok: true as const, next: '/verify-email' };
    } catch (error) {
      if (error instanceof FieldErrors) {
        if (error.fields.password) return { ok: false as const, reason: 'weak_password' as const };
        return { ok: false as const, reason: 'invalid_email' as const };
      }
      if (error instanceof RateLimited)
        return { ok: false as const, reason: 'rate_limited' as const };
      return { ok: false as const, reason: 'network' as const };
    }
  }

  async verifyEmail(input: { code: string }) {
    const email = await this.io.readPending();
    if (!email) return { ok: false as const, reason: 'expired' as const };
    try {
      const result = await this.service.verifyCode(
        { email, code: input.code },
        await this.io.meta(),
      );
      if (result.status === 'verified') {
        await this.io.setSession(result.session.token, 'viewer');
        return { ok: true as const, next: '/profiles' };
      }
      if (result.status === 'expired') return { ok: false as const, reason: 'expired' as const };
      if (result.status === 'too_many')
        return { ok: false as const, reason: 'too_many' as const, minutes: 15 };
      return { ok: false as const, reason: 'wrong' as const };
    } catch (error) {
      if (error instanceof RateLimited) {
        return {
          ok: false as const,
          reason: 'too_many' as const,
          minutes: minutes(error.retryAfterSeconds),
        };
      }
      return { ok: false as const, reason: 'network' as const };
    }
  }

  async resendCode() {
    const email = await this.io.readPending();
    if (!email) return { ok: true as const };
    try {
      await this.service.resendVerification({ email }, await this.io.meta());
      return { ok: true as const };
    } catch (error) {
      if (error instanceof RateLimited)
        return { ok: false as const, reason: 'resend_limit' as const };
      return { ok: false as const, reason: 'network' as const };
    }
  }

  async requestPasswordReset(input: { email: string }) {
    try {
      await this.service.requestPasswordReset(input, await this.io.meta());
      return { ok: true as const };
    } catch (error) {
      if (error instanceof RateLimited)
        return { ok: false as const, reason: 'rate_limited' as const };
      return { ok: false as const, reason: 'network' as const };
    }
  }

  async resetPassword(input: { token: string; password: string }) {
    try {
      await this.service.resetPassword(input, await this.io.meta());
      return { ok: true as const };
    } catch (error) {
      if (error instanceof TokenRejected) return { ok: false as const, reason: 'expired' as const };
      if (error instanceof FieldErrors)
        return { ok: false as const, reason: 'weak_password' as const };
      return { ok: false as const, reason: 'network' as const };
    }
  }

  async confirmEmailLink(token: string) {
    const result = await this.service.verifyLink(token, await this.io.meta());
    if (result.status === 'verified') return 'confirmed' as const;
    if (result.status === 'used') return 'used' as const;
    return 'expired' as const;
  }

  async signOut() {
    const token = await this.io.readSessionToken();
    if (token) await this.service.signOut(token, await this.io.meta());
    await this.io.clearSession();
  }

  async checkPassword(password: string) {
    const actor = await this.io.currentActor();
    if (!actor) return { ok: false as const, reason: 'wrong' as const, triesLeft: 0 };
    try {
      await this.service.reauthenticate(actor, password, await this.io.meta());
      return { ok: true as const };
    } catch (error) {
      if (error instanceof RateLimited) {
        return {
          ok: false as const,
          reason: 'locked' as const,
          minutes: minutes(error.retryAfterSeconds),
        };
      }
      return {
        ok: false as const,
        reason: 'wrong' as const,
        triesLeft: await this.service.triesLeft(actor),
      };
    }
  }
}
