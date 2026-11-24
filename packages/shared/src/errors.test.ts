import { describe, expect, it } from 'vitest';
import {
  AppError,
  ChallengeRequired,
  Conflict,
  Forbidden,
  NotFound,
  RateLimited,
  Unauthorized,
  ValidationFailed,
  isAppError,
  toHttpStatus,
} from './errors';

describe('AppError subclasses', () => {
  it('map to the status code of their kind', () => {
    expect(toHttpStatus(new Unauthorized())).toBe(401);
    expect(toHttpStatus(new Forbidden())).toBe(403);
    expect(toHttpStatus(new NotFound())).toBe(404);
    expect(toHttpStatus(new Conflict())).toBe(409);
    expect(toHttpStatus(new ValidationFailed({ title: ['required'] }))).toBe(422);
    expect(toHttpStatus(new RateLimited(30))).toBe(429);
    expect(toHttpStatus(new ChallengeRequired())).toBe(403);
    expect(new ChallengeRequired().code).toBe('challenge_required');
  });

  it('turns an unknown error into a 500', () => {
    expect(toHttpStatus(new Error('boom'))).toBe(500);
    expect(toHttpStatus('string thrown')).toBe(500);
  });

  it('carries retryAfterSeconds on RateLimited', () => {
    expect(new RateLimited(42).retryAfterSeconds).toBe(42);
  });

  it('carries field issues on ValidationFailed', () => {
    expect(new ValidationFailed({ email: ['invalid'] }).fields).toEqual({ email: ['invalid'] });
  });

  it('is recognised by isAppError and keeps a stable code', () => {
    const err = new NotFound('Video not found');
    expect(isAppError(err)).toBe(true);
    expect(err).toBeInstanceOf(AppError);
    expect(err.code).toBe('not_found');
    expect(err.message).toBe('Video not found');
    expect(isAppError(new Error('x'))).toBe(false);
  });
});
