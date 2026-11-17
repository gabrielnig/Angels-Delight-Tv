import type { AuthGateway } from '../types';

/**
 * Fixture auth rules, for demos and tests only. The real gateway comes from lane B.
 *  - password "wrong-password" is refused, "lock-me-out" reports a lockout, "offline-please" a network error
 *  - verification code 000000 is wrong, 111111 expired, anything else is accepted
 */
export class FixtureAuth implements AuthGateway {
  private triesLeft = 3;

  async signIn({ email, password, next }: { email: string; password: string; next?: string }) {
    if (!email.includes('@')) return { ok: false as const, reason: 'invalid' as const };
    if (password === 'lock-me-out') return { ok: false as const, reason: 'locked' as const, minutes: 12 };
    if (password === 'offline-please') return { ok: false as const, reason: 'network' as const };
    if (password === 'wrong-password') return { ok: false as const, reason: 'invalid' as const };
    return { ok: true as const, next: safeNext(next) };
  }

  async signUp({ email, password }: { email: string; password: string }) {
    if (!email.includes('@')) return { ok: false as const, reason: 'invalid_email' as const };
    if (password.length < 10) return { ok: false as const, reason: 'weak_password' as const };
    return { ok: true as const, next: '/verify-email' };
  }

  async verifyEmail({ code }: { code: string }) {
    if (code === '000000') return { ok: false as const, reason: 'wrong' as const };
    if (code === '111111') return { ok: false as const, reason: 'expired' as const };
    return { ok: true as const, next: '/profiles' };
  }

  async resendCode() {
    return { ok: true as const };
  }

  async requestPasswordReset() {
    return { ok: true as const };
  }

  async resetPassword({ password }: { token: string; password: string }) {
    if (password.length < 10) return { ok: false as const, reason: 'weak_password' as const };
    return { ok: true as const };
  }

  async confirmEmailLink(token: string) {
    if (token === 'used') return 'used' as const;
    if (token === 'expired' || token === '') return 'expired' as const;
    return 'confirmed' as const;
  }

  async signOut() {}

  async checkPassword(password: string) {
    if (password === 'lock-me-out') return { ok: false as const, reason: 'locked' as const, minutes: 15 };
    if (password.length < 10 || password === 'wrong-password') {
      this.triesLeft = Math.max(0, this.triesLeft - 1);
      return { ok: false as const, reason: 'wrong' as const, triesLeft: this.triesLeft };
    }
    this.triesLeft = 3;
    return { ok: true as const };
  }
}

/** Same origin paths only, never an absolute or protocol relative URL. */
export function safeNext(next: string | undefined | null): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.includes('\\')) return '/profiles';
  return next;
}
