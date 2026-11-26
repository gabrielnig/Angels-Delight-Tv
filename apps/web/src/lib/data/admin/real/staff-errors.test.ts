import { ReauthRequired } from '@ad/auth';
import { MailDeliveryError } from '@ad/mailer';
import { describe, expect, it } from 'vitest';
import { inviteMailFailure, staffFailure } from './staff-errors';

describe('staffFailure', () => {
  it('turns ReauthRequired into a typed reauth result', () => {
    expect(staffFailure(new ReauthRequired())).toEqual({
      ok: false,
      error: 'Confirm your password to continue.',
      reauth: true,
    });
  });

  it('recognises a ReauthRequired from another copy of the auth package by name', () => {
    class ReauthRequired extends Error {
      constructor() {
        super('Confirm your password to continue');
        this.name = 'ReauthRequired';
      }
    }
    expect(staffFailure(new ReauthRequired())).toMatchObject({ ok: false, reauth: true });
  });

  it('still rethrows a real fault', () => {
    expect(() => staffFailure(new Error('boom'))).toThrow('boom');
  });
});

describe('inviteMailFailure', () => {
  it('says the invite was saved and where to resend it when mail fails', () => {
    expect(inviteMailFailure(new MailDeliveryError())).toEqual({
      ok: false,
      error:
        'The invite was saved but the email could not be sent. Resend it from Pending invites.',
    });
  });

  it('passes other errors through staffFailure', () => {
    expect(inviteMailFailure(new ReauthRequired())).toMatchObject({ reauth: true });
  });
});
