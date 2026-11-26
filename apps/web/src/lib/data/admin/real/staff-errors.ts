import 'server-only';
import { FieldErrors, InvalidCredentials, ReauthRequired } from '@ad/auth';
import { MailDeliveryError } from '@ad/mailer';
import { Conflict, Forbidden, NotFound, RateLimited } from '@ad/shared';
import type { CommandResult } from '../video-commands';

const fail = (error: string, reauth?: true): CommandResult =>
  reauth ? { ok: false, error, reauth } : { ok: false, error };

/**
 * Matches by name as well as by class. A server action bundle can hold its own copy of the auth package, and
 * then `instanceof` is false for an error thrown by the other copy, which showed as a generic failure toast.
 */
function isReauthRequired(error: unknown): boolean {
  return (
    error instanceof ReauthRequired ||
    (error instanceof Error && error.name === 'ReauthRequired')
  );
}

const minutes = (seconds: number) => Math.max(1, Math.ceil(seconds / 60));

/**
 * Turns what the lane B services throw into the plain results the admin screens show.
 * Anything not listed is a real fault and is rethrown for the error page.
 */
export function staffFailure(
  error: unknown,
  notFound = 'That person was not found.',
): CommandResult {
  if (isReauthRequired(error)) return fail('Confirm your password to continue.', true);
  if (error instanceof FieldErrors) {
    const first = Object.values(error.fields)[0];
    return fail(first ?? 'Check the details and try again.');
  }
  if (error instanceof InvalidCredentials) return fail(error.message);
  if (error instanceof RateLimited) {
    const wait = minutes(error.retryAfterSeconds);
    return fail(`Too many attempts. Try again in ${wait} ${wait === 1 ? 'minute' : 'minutes'}.`);
  }
  if (error instanceof Forbidden) {
    return fail(
      error.message && error.message !== 'Not allowed'
        ? error.message
        : 'You do not have permission for this.',
    );
  }
  if (error instanceof NotFound) return fail(notFound);
  if (error instanceof Conflict) return fail(error.message);
  throw error;
}

/** An invite is saved before its email goes out, so a mail fault gets its own words and a next step (R39). */
export function inviteMailFailure(error: unknown): CommandResult {
  if (error instanceof MailDeliveryError || (error instanceof Error && error.name === 'MailDeliveryError'))
    return fail(
      'The invite was saved but the email could not be sent. Resend it from Pending invites.',
    );
  return staffFailure(error);
}
