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
});
