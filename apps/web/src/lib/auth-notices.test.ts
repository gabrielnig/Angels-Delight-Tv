import { describe, expect, it } from 'vitest';
import { signInNotice, signInNoticeTone, signInRedirect } from './auth-notices';

describe('sign in notices (M01-S12 AC3)', () => {
  it('explains a session that ended elsewhere', () => {
    expect(signInNotice('ended')).toBe('Your session ended. Sign in again to keep watching.');
  });

  it('shows the reset notice as success and the ended notice as information (S01 mockup)', () => {
    expect(signInNoticeTone('reset')).toBe('success');
    expect(signInNoticeTone('ended')).toBe('info');
    expect(signInNoticeTone('nope')).toBeUndefined();
  });

  it('keeps the reset notice', () => {
    expect(signInNotice('reset')).toBe('Your password was changed. Sign in with your new password.');
  });

  it('ignores unknown codes', () => {
    expect(signInNotice('nope')).toBeUndefined();
    expect(signInNotice(undefined)).toBeUndefined();
  });

  it('builds the redirect with next and an optional notice', () => {
    expect(signInRedirect('/watch/a b')).toBe('/sign-in?next=%2Fwatch%2Fa%20b');
    expect(signInRedirect('/my-list', 'ended')).toBe('/sign-in?next=%2Fmy-list&notice=ended');
  });
});
