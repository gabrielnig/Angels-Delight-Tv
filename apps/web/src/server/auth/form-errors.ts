import {
  AccountUnavailable,
  FieldErrors,
  InvalidCredentials,
  KeyUnavailable,
  ReauthRequired,
  InviteRequired,
  TokenRejected,
} from '@ad/auth';
import { MailDeliveryError } from '@ad/mailer';
import { LimiterUnavailable } from '@ad/security';
import { RateLimited } from '@ad/shared';
import { msg } from '@ad/shared/messages';

/** What a form shows after an action. Plain data, so it crosses the server and client boundary. */
export interface FormState {
  error?: string;
  fields?: Record<string, string>;
  retryAfter?: number;
  notice?: string;
  email?: string;
}

function waitText(seconds: number): string {
  return msg('auth.wait.minutes', { count: Math.max(1, Math.ceil(seconds / 60)) });
}

/** Turns a thrown error into a message that is safe to show. Unknown errors never leak details. */
export function toFormState(error: unknown): FormState {
  if (error instanceof FieldErrors) return { fields: error.fields };
  if (error instanceof InvalidCredentials) return { error: error.message };
  if (error instanceof RateLimited) {
    return {
      error: msg('auth.error.rateLimited', { wait: waitText(error.retryAfterSeconds) }),
      retryAfter: error.retryAfterSeconds,
    };
  }
  if (error instanceof TokenRejected) {
    if (error.problem === 'expired') return { error: msg('auth.error.linkExpired') };
    if (error.problem === 'used') return { error: msg('auth.error.linkUsed') };
    return { error: msg('auth.error.linkInvalid') };
  }
  if (error instanceof ReauthRequired) return { error: error.message };
  if (error instanceof InviteRequired) return { error: msg('auth.error.inviteInvalid') };
  if (error instanceof AccountUnavailable) return { error: error.message };
  if (error instanceof MailDeliveryError) {
    return { error: msg('auth.error.mailFailed') };
  }
  if (error instanceof LimiterUnavailable || error instanceof KeyUnavailable) {
    return { error: msg('auth.error.unavailable') };
  }
  return { error: msg('auth.error.generic') };
}
