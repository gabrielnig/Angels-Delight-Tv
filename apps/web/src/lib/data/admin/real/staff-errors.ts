import 'server-only';
import { FieldErrors, InvalidCredentials, ReauthRequired } from '@ad/auth';
import { Conflict, Forbidden, NotFound, RateLimited } from '@ad/shared';
import type { CommandResult } from '../video-commands';

const fail = (error: string, reauth?: true): CommandResult =>
  reauth ? { ok: false, error, reauth } : { ok: false, error };

const minutes = (seconds: number) => Math.max(1, Math.ceil(seconds / 60));

/**
 * Turns what the lane B services throw into the plain results the admin screens show.
 * Anything not listed is a real fault and is rethrown for the error page.
 */
export function staffFailure(
  error: unknown,
  notFound = 'That person was not found.',
): CommandResult {
  if (error instanceof ReauthRequired) return fail('Confirm your password to continue.', true);
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
  if (error instanceof Conflict) {
    return fail(
      error.message.includes('Super admin') ? 'There must be at least one admin.' : error.message,
    );
  }
  throw error;
}
