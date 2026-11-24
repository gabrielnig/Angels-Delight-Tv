import { describe, expect, it } from 'vitest';
import {
  guestCookieName,
  guestCookieOptions,
  newGuestId,
  readGuest,
  signGuest,
} from './guest-cookie';
import { resolveGuest } from './resolve-guest';

const secret = new Uint8Array(32).fill(7);
const other = new Uint8Array(32).fill(8);

describe('guest cookie', () => {
  it('uses the host prefix only when secure', () => {
    expect(guestCookieName(true)).toBe('__Host-ad_guest');
    expect(guestCookieName(false)).toBe('ad_guest');
  });

  it('is http only, lax, root path and lasts 180 days', () => {
    expect(guestCookieOptions(true)).toEqual({
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 180,
    });
    expect(guestCookieOptions(false).secure).toBe(false);
  });

  it('mints 128 bit url safe ids that differ every time', () => {
    const a = newGuestId();
    expect(a).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(newGuestId()).not.toBe(a);
  });

  it('round trips a signed id', () => {
    const id = newGuestId();
    expect(readGuest(secret, signGuest(secret, id))).toBe(id);
  });

  it('refuses a forged mac, a different secret, a truncated and an empty value', () => {
    const id = newGuestId();
    const good = signGuest(secret, id);
    expect(readGuest(secret, `${id}.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`)).toBeNull();
    expect(readGuest(other, good)).toBeNull();
    expect(readGuest(secret, good.slice(0, -4))).toBeNull();
    expect(readGuest(secret, id)).toBeNull();
    expect(readGuest(secret, '')).toBeNull();
    expect(readGuest(secret, undefined)).toBeNull();
    expect(readGuest(secret, `${newGuestId()}.${good.split('.')[1]}`)).toBeNull();
  });

  it('does not accept a signed account profile value as a guest id', () => {
    expect(readGuest(secret, 'x.y.z')).toBeNull();
  });
});

describe('resolveGuest', () => {
  const req = (cookie?: string) =>
    new Request('https://app.example/api/play/x/session', {
      method: 'POST',
      ...(cookie ? { headers: { cookie } } : {}),
    });
  const opts = { secret, secure: true };

  it('returns a valid cookie id without minting', () => {
    const id = newGuestId();
    const r = resolveGuest(req(`__Host-ad_guest=${signGuest(secret, id)}`), { ...opts, mint: true });
    expect(r).toEqual({ guestId: id, isNew: false });
  });

  it('mints only when asked and the cookie is absent', () => {
    expect(resolveGuest(req(), { ...opts, mint: false })).toBeNull();
    const minted = resolveGuest(req(), { ...opts, mint: true });
    expect(minted?.isNew).toBe(true);
    expect(minted?.guestId).toMatch(/^[A-Za-z0-9_-]{22}$/);
  });

  it('treats a forged cookie as absent', () => {
    const forged = `__Host-ad_guest=${newGuestId()}.bogus`;
    expect(resolveGuest(req(forged), { ...opts, mint: false })).toBeNull();
    expect(resolveGuest(req(forged), { ...opts, mint: true })?.isNew).toBe(true);
  });

  it('reads the plain name when not secure', () => {
    const id = newGuestId();
    const r = resolveGuest(req(`ad_guest=${signGuest(secret, id)}`), {
      secret,
      secure: false,
      mint: false,
    });
    expect(r?.guestId).toBe(id);
  });
});
