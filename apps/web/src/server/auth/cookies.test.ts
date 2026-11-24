import { describe, expect, it } from 'vitest';
import {
  pendingCookieName,
  pendingCookieOptions,
  sessionCookieName,
  sessionCookieOptions,
  twoStepCookieName,
} from './cookies';

describe('session cookie', () => {
  it('uses the __Host- prefix when secure cookies are on and a plain name over http', () => {
    expect(sessionCookieName(true)).toBe('__Host-ad_session');
    expect(sessionCookieName(false)).toBe('ad_session');
  });

  it('is HttpOnly, SameSite=Lax, Path=/ and has no Domain', () => {
    const options = sessionCookieOptions({ secure: true, kind: 'viewer', idleSeconds: 2592000 });
    expect(options).toMatchObject({ httpOnly: true, secure: true, sameSite: 'lax', path: '/' });
    expect(options).not.toHaveProperty('domain');
  });

  it('gives viewers a Max-Age equal to the idle window', () => {
    expect(
      sessionCookieOptions({ secure: true, kind: 'viewer', idleSeconds: 2592000 }).maxAge,
    ).toBe(2592000);
  });

  it('makes staff cookies session cookies with no Max-Age or Expires', () => {
    const options = sessionCookieOptions({ secure: true, kind: 'staff', idleSeconds: 1800 });
    expect(options).not.toHaveProperty('maxAge');
    expect(options).not.toHaveProperty('expires');
  });

  it('keeps a pending second factor cookie to ten minutes', () => {
    expect(
      sessionCookieOptions({ secure: true, kind: 'pending_mfa', idleSeconds: 600 }).maxAge,
    ).toBe(600);
  });

  it('only sets Secure when asked, so localhost over http keeps working', () => {
    expect(sessionCookieOptions({ secure: false, kind: 'viewer', idleSeconds: 60 }).secure).toBe(
      false,
    );
  });
});

describe('pending verification cookie', () => {
  it('is prefixed and short lived', () => {
    expect(pendingCookieName(true)).toBe('__Host-ad_pv');
    expect(pendingCookieName(false)).toBe('ad_pv');
    expect(pendingCookieOptions(true, 1800)).toMatchObject({
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 1800,
      secure: true,
    });
  });
});

describe('two step pending cookie', () => {
  it('uses the host prefix when cookies are secure', () => {
    expect(twoStepCookieName(true)).toBe('__Host-ad_mv');
    expect(twoStepCookieName(false)).toBe('ad_mv');
  });
});
