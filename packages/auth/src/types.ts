import type { Database } from '@ad/db';
import type { Mailer } from '@ad/mailer';
import type { AuditWriter } from '@ad/audit';
import type { LockoutStore, RateLimiter } from '@ad/security';
import type { KeyService } from './keys';
import type { PasswordHasher } from './password';
import type { SessionContext, SessionService } from './sessions';

export interface AuthConfig {
  verifyCodeTtlSeconds: number;
  verifyLinkTtlSeconds: number;
  verifyCodeMaxAttempts: number;
  resetTtlSeconds: number;
  emailChangeTtlSeconds: number;
  inviteTtlSeconds: number;
  /** Days between a deletion request and the purge (M02-S06). A site setting in the app. */
  deletionGraceDays: number;
  /** Password confirmation stays valid for sensitive actions this long (SECURITY.md section 4). */
  reauthWindowSeconds: number;
  /** Versions recorded in `consents` at sign up. Content owned by the client (legal.*_version). */
  legalVersions: { terms: string; privacy: string; guardian_declaration: string };
  supportEmail: string;
  /** Shown in authenticator apps next to the account name. Follows the platform name setting. */
  issuerName: string;
  /** Closed sign up: when false, sign up is refused (M29 flag). */
  signUpOpen: boolean;
  /** Development only: skips the second factor for staff. The web env schema rejects it in production. */
  devSkipMfa: boolean;
}

export const DEFAULT_AUTH_CONFIG: AuthConfig = {
  verifyCodeTtlSeconds: 15 * 60,
  verifyLinkTtlSeconds: 24 * 3600,
  verifyCodeMaxAttempts: 5,
  resetTtlSeconds: 30 * 60,
  emailChangeTtlSeconds: 24 * 3600,
  inviteTtlSeconds: 72 * 3600,
  deletionGraceDays: 14,
  reauthWindowSeconds: 10 * 60,
  legalVersions: { terms: '1', privacy: '1', guardian_declaration: '1' },
  supportEmail: 'support@example.org',
  issuerName: 'Angels Delight TV',
  signUpOpen: true,
  devSkipMfa: false,
};

export interface Logger {
  warn(message: string, fields?: Record<string, unknown>): void;
  error(message: string, fields?: Record<string, unknown>): void;
}

export interface AuthDeps {
  db: Database;
  keys: KeyService;
  sessions: SessionService;
  hasher: PasswordHasher;
  limiter: RateLimiter;
  lockouts: LockoutStore;
  audit: AuditWriter;
  mailer: Mailer;
  /** EMAIL_HASH_PEPPER. Also keys the pending verification cookie and verification code hashes. */
  pepper: Uint8Array;
  /** FIELD_KEK, used directly only for invite addresses that have no account key yet. */
  kek: Uint8Array;
  config?: Partial<AuthConfig>;
  clock?: () => Date;
  logger?: Logger;
  /** Known breach check (HIBP). Defaults to no check. */
  isBreached?: (password: string) => Promise<boolean>;
  /**
   * Runs work after the response is decided, so mail latency does not reveal whether an address has an
   * account. Defaults to fire and forget with errors logged. Tests collect and await it.
   */
  background?: (task: Promise<unknown>) => void;
}

export interface RequestMeta {
  /** Raw client address when it can be trusted, otherwise null. Never stored, only truncated. */
  ip: string | null;
  ipTrunc: string | null;
  userAgent: string | null;
  requestId: string | null;
}

export const NO_META: RequestMeta = { ip: null, ipTrunc: null, userAgent: null, requestId: null };

export type Actor = Pick<SessionContext, 'accountId' | 'role' | 'sessionId'>;

/** Same message for unknown email, wrong password and wrong account type. */
export class InvalidCredentials extends Error {
  constructor() {
    super('Email or password is incorrect');
    this.name = 'InvalidCredentials';
  }
}

export class AccountUnavailable extends Error {
  constructor() {
    super('This account is not available');
    this.name = 'AccountUnavailable';
  }
}

export class SignUpClosed extends Error {
  constructor() {
    super('Sign up is closed');
    this.name = 'SignUpClosed';
  }
}

/** Field level problems for forms (maps to HTTP 422). */
export class FieldErrors extends Error {
  constructor(readonly fields: Record<string, string>) {
    super('Validation failed');
    this.name = 'FieldErrors';
  }
}

export type TokenProblem = 'invalid' | 'used' | 'expired';

export class TokenRejected extends Error {
  constructor(readonly problem: TokenProblem) {
    super(`Token ${problem}`);
    this.name = 'TokenRejected';
  }
}

export class ReauthRequired extends Error {
  constructor() {
    super('Confirm your password to continue');
    this.name = 'ReauthRequired';
  }
}
