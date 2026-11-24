export type ErrorCode =
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'validation_failed'
  | 'rate_limited'
  | 'challenge_required';

export abstract class AppError extends Error {
  abstract readonly code: ErrorCode;
  abstract readonly status: number;
}

export class Unauthorized extends AppError {
  readonly code = 'unauthorized';
  readonly status = 401;
  constructor(message = 'Authentication required') {
    super(message);
    this.name = 'Unauthorized';
  }
}

export class Forbidden extends AppError {
  readonly code = 'forbidden';
  readonly status = 403;
  constructor(message = 'Not allowed') {
    super(message);
    this.name = 'Forbidden';
  }
}

export class NotFound extends AppError {
  readonly code = 'not_found';
  readonly status = 404;
  constructor(message = 'Not found') {
    super(message);
    this.name = 'NotFound';
  }
}

export class Conflict extends AppError {
  readonly code = 'conflict';
  readonly status = 409;
  constructor(message = 'Conflict') {
    super(message);
    this.name = 'Conflict';
  }
}

export class ValidationFailed extends AppError {
  readonly code = 'validation_failed';
  readonly status = 422;
  constructor(
    readonly fields: Record<string, string[]>,
    message = 'Validation failed',
  ) {
    super(message);
    this.name = 'ValidationFailed';
  }
}

export class RateLimited extends AppError {
  readonly code = 'rate_limited';
  readonly status = 429;
  constructor(
    readonly retryAfterSeconds: number,
    message = 'Too many requests',
  ) {
    super(message);
    this.name = 'RateLimited';
  }
}

/**
 * A visitor with no account must pass a human check before a playback session is minted (M40-S11). 403 so
 * a client that does not know the code treats it as refused, with a code the player can answer.
 */
export class ChallengeRequired extends AppError {
  readonly code = 'challenge_required';
  readonly status = 403;
  constructor(message = 'Please confirm you are a person to keep watching') {
    super(message);
    this.name = 'ChallengeRequired';
  }
}

export function isAppError(value: unknown): value is AppError {
  return value instanceof AppError;
}

/** One place that maps errors to status codes. Unknown errors are 500 and must be logged by the caller. */
export function toHttpStatus(error: unknown): number {
  return isAppError(error) ? error.status : 500;
}
