import { hmacSha256 } from '@ad/shared';
import { describe, expect, it } from 'vitest';
import { issuePlaybackToken, secretRing, verifyPlaybackToken } from './playback-token';

const k = (fill: number) => new Uint8Array(32).fill(fill);
const base = {
  videoId: '0192f0a0-0000-7000-8000-000000000001',
  profileId: '0192f0a0-0000-7000-8000-000000000002',
  accountId: '0192f0a0-0000-7000-8000-000000000003',
};

describe('playback tokens', () => {
  const now = 1_700_000_000;

  it('round trips claims with a 30 minute life', () => {
    const ring = secretRing(k(1));
    const token = issuePlaybackToken(ring, { ...base, now: () => now });
    expect(token.startsWith('v1.')).toBe(true);
    const result = verifyPlaybackToken(ring, token, { now: () => now + 60 });
    expect(result).toMatchObject({
      ok: true,
      claims: { vid: base.videoId, pid: base.profileId, aid: base.accountId, exp: now + 1800 },
    });
  });

  it('rejects expired, tampered, malformed and wrong-secret tokens', () => {
    const ring = secretRing(k(1));
    const token = issuePlaybackToken(ring, { ...base, now: () => now });
    expect(verifyPlaybackToken(ring, token, { now: () => now + 1831 })).toEqual({
      ok: false,
      reason: 'expired',
    });
    const [v, kid, payload, mac] = token.split('.');
    const forged = Buffer.from(
      JSON.stringify({ ...JSON.parse(Buffer.from(payload!, 'base64url').toString()), vid: 'x' }),
    ).toString('base64url');
    expect(verifyPlaybackToken(ring, `${v}.${kid}.${forged}.${mac}`, { now: () => now })).toEqual({
      ok: false,
      reason: 'invalid',
    });
    expect(verifyPlaybackToken(ring, 'garbage', { now: () => now })).toEqual({
      ok: false,
      reason: 'invalid',
    });
    expect(verifyPlaybackToken(secretRing(k(2)), token, { now: () => now })).toEqual({
      ok: false,
      reason: 'invalid',
    });
  });

  it('keeps tokens valid across a rotation through the previous secret', () => {
    const old = issuePlaybackToken(secretRing(k(1)), { ...base, now: () => now });
    const rotated = secretRing(k(2), k(1));
    expect(verifyPlaybackToken(rotated, old, { now: () => now }).ok).toBe(true);
    const fresh = issuePlaybackToken(rotated, { ...base, now: () => now });
    expect(verifyPlaybackToken(secretRing(k(1)), fresh, { now: () => now }).ok).toBe(false);
  });

  it('can bind to an expected video', () => {
    const ring = secretRing(k(1));
    const token = issuePlaybackToken(ring, { ...base, now: () => now });
    expect(verifyPlaybackToken(ring, token, { now: () => now, videoId: 'other' })).toEqual({
      ok: false,
      reason: 'wrong_video',
    });
  });

  it('issues one hour preview tokens for admins with no profile', () => {
    const ring = secretRing(k(1));
    const token = issuePlaybackToken(ring, {
      videoId: base.videoId,
      accountId: base.accountId,
      preview: true,
      now: () => now,
    });
    const result = verifyPlaybackToken(ring, token, { now: () => now });
    expect(result).toMatchObject({ ok: true, claims: { pid: null, pv: true, exp: now + 3600 } });
  });

  it('issues guest tokens with the guest id as aid, no profile and gst set', () => {
    const ring = secretRing(k(1));
    const token = issuePlaybackToken(ring, {
      videoId: base.videoId,
      accountId: 'guestid',
      guest: true,
      now: () => now,
    });
    const result = verifyPlaybackToken(ring, token, { now: () => now });
    expect(result).toMatchObject({
      ok: true,
      claims: { pid: null, aid: 'guestid', gst: true, exp: now + 1800 },
    });
    if (result.ok) {
      expect(result.claims.pv).toBeUndefined();
      expect(result.claims.kd).toBeUndefined();
    }
  });

  it('marks kids mode guest tokens with kd', () => {
    const ring = secretRing(k(1));
    const token = issuePlaybackToken(ring, {
      videoId: base.videoId,
      accountId: 'guestid',
      guest: true,
      kids: true,
      now: () => now,
    });
    expect(verifyPlaybackToken(ring, token, { now: () => now })).toMatchObject({
      ok: true,
      claims: { gst: true, kd: true },
    });
  });

  it('never issues a guest preview token and rejects one with both gst and pv', () => {
    const ring = secretRing(k(1));
    expect(() =>
      issuePlaybackToken(ring, {
        videoId: base.videoId,
        accountId: 'g',
        guest: true,
        preview: true,
      }),
    ).toThrow();
    const payload = Buffer.from(
      JSON.stringify({
        vid: 'v',
        pid: null,
        aid: 'g',
        iat: now,
        exp: now + 100,
        n: 'n',
        gst: true,
        pv: true,
      }),
    ).toString('base64url');
    // Sign it properly so only the claim rule can refuse it.
    const real = issuePlaybackToken(ring, { ...base, now: () => now });
    const [v, kid] = real.split('.');
    const head = `${v}.${kid}.${payload}`;

    const mac = Buffer.from(hmacSha256(k(1), head)).toString('base64url');
    expect(verifyPlaybackToken(ring, `${head}.${mac}`, { now: () => now })).toEqual({
      ok: false,
      reason: 'invalid',
    });
  });

  it('still verifies a token issued before the guest claims existed', () => {
    const ring = secretRing(k(1));
    const token = issuePlaybackToken(ring, { ...base, now: () => now });
    const result = verifyPlaybackToken(ring, token, { now: () => now });
    expect(result.ok && result.claims.gst).toBeUndefined();
  });
});
