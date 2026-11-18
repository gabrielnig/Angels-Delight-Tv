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

/** What a form shows after an action. Plain data, so it crosses the server and client boundary. */
export interface FormState {
  error?: string;
  fields?: Record<string, string>;
  retryAfter?: number;
  notice?: string;
  email?: string;
}

const GENERIC = 'Something went wrong. Please try again.';

function waitText(seconds: number): string {
  const minutes = Math.max(1, Math.ceil(seconds / 60));
  return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`;
}

/** Turns a thrown error into a message that is safe to show. Unknown errors never leak details. */
export function toFormState(error: unknown): FormState {
  if (error instanceof FieldErrors) return { fields: error.fields };
  if (error instanceof InvalidCredentials) return { error: error.message };
  if (error instanceof RateLimited) {
    return {
      error: `Too many attempts. Try again in ${waitText(error.retryAfterSeconds)}.`,
      retryAfter: error.retryAfterSeconds,
    };
  }
  if (error instanceof TokenRejected) {
    if (error.problem === 'expired') return { error: 'This link has expired. Request a new one.' };
    if (error.problem === 'used') return { error: 'This link has already been used.' };
    return { error: 'This link is not valid. Request a new one.' };
  }
  if (error instanceof ReauthRequired) return { error: error.message };
  if (error instanceof InviteRequired)
    return { error: 'That invite code is not valid. Check it and try again.' };
  if (error instanceof AccountUnavailable) return { error: error.message };
  if (error instanceof MailDeliveryError) {
    return { error: 'We could not send the email. Please try again in a moment.' };
  }
  if (error instanceof LimiterUnavailable || error instanceof KeyUnavailable) {
    return { error: 'This is unavailable right now. Please try again shortly.' };
  }
  return { error: GENERIC };
}
