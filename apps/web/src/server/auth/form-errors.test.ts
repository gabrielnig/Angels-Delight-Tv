import { FieldErrors, InvalidCredentials, TokenRejected } from '@ad/auth';
import { RateLimited } from '@ad/shared';
import { describe, expect, it } from 'vitest';
import { toFormState } from './form-errors';

describe('toFormState', () => {
  it('maps field errors to a fields map', () => {
    expect(toFormState(new FieldErrors({ email: 'Enter a valid email address' }))).toEqual({
      fields: { email: 'Enter a valid email address' },
    });
  });

  it('gives one message for bad credentials', () => {
    expect(toFormState(new InvalidCredentials()).error).toBe('Email or password is incorrect');
  });

  it('tells the person how long to wait when rate limited', () => {
    const state = toFormState(new RateLimited(125));
    expect(state.error).toContain('3 minutes');
    expect(state.retryAfter).toBe(125);
  });

  it('explains dead tokens in plain words', () => {
    expect(toFormState(new TokenRejected('expired')).error).toMatch(/expired/i);
    expect(toFormState(new TokenRejected('used')).error).toMatch(/already been used/i);
  });

  it('never leaks unknown errors', () => {
    const state = toFormState(new Error('connect ECONNREFUSED 10.0.0.5:5432'));
    expect(state.error).toBe('Something went wrong. Please try again.');
  });
});
