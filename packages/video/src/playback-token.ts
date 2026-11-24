import { constantTimeEqual, hmacSha256, randomToken, sha256 } from '@ad/shared';

export const PLAYBACK_TOKEN_SECONDS = 30 * 60;
export const PREVIEW_TOKEN_SECONDS = 60 * 60;
const SKEW_SECONDS = 30;

export interface SecretRing {
  current: Uint8Array;
  previous?: Uint8Array;
}

/** `PLAYBACK_TOKEN_SECRET` and, during rotation, `PLAYBACK_TOKEN_SECRET_PREVIOUS`. */
export function secretRing(current: Uint8Array, previous?: Uint8Array): SecretRing {
  return previous ? { current, previous } : { current };
}

export interface PlaybackClaims {
  vid: string;
  /** Null for admin previews, which have no viewer profile. */
  pid: string | null;
  aid: string;
  iat: number;
  exp: number;
  n: string;
  /** True for admin preview tokens: no analytics, no progress. */
  pv?: true;
  /** True for a guest token: `aid` is the guest id (not an account), `pid` is null (D-G4). */
  gst?: true;
  /** Kids mode guest: the key route requires a kids safe video. */
  kd?: true;
}

/** A short key id derived from the secret, so rotation needs no extra configuration. */
function kidOf(secret: Uint8Array): string {
  return Buffer.from(sha256(secret)).toString('base64url').slice(0, 6);
}

const mac = (secret: Uint8Array, signed: string) =>
  Buffer.from(hmacSha256(secret, signed)).toString('base64url');

export interface IssueInput {
  videoId: string;
  accountId: string;
  profileId?: string;
  preview?: boolean;
  /** A guest token. `accountId` carries the guest id. Never combined with `preview`. */
  guest?: boolean;
  /** Kids mode for a guest token. */
  kids?: boolean;
  now?: () => number;
}

/** `v1.{kid}.{payload}.{mac}` per ARCHITECTURE section 11. */
export function issuePlaybackToken(ring: SecretRing, input: IssueInput): string {
  if (input.guest && input.preview) throw new Error('A guest token can never be a preview');
  const iat = Math.floor((input.now ?? (() => Date.now() / 1000))());
  const claims: PlaybackClaims = {
    vid: input.videoId,
    pid: input.profileId ?? null,
    aid: input.accountId,
    iat,
    exp: iat + (input.preview ? PREVIEW_TOKEN_SECONDS : PLAYBACK_TOKEN_SECONDS),
    n: randomToken(6),
    ...(input.preview ? { pv: true as const } : {}),
    ...(input.guest ? { gst: true as const } : {}),
    ...(input.guest && input.kids ? { kd: true as const } : {}),
  };
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
  const head = `v1.${kidOf(ring.current)}.${payload}`;
  return `${head}.${mac(ring.current, head)}`;
}

export type TokenVerdict =
  | { ok: true; claims: PlaybackClaims }
  | { ok: false; reason: 'invalid' | 'expired' | 'wrong_video' };

export interface VerifyOptions {
  now?: () => number;
  videoId?: string;
}

function parseClaims(payload: string): PlaybackClaims | null {
  try {
    const value = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as PlaybackClaims;
    const valid =
      typeof value.vid === 'string' &&
      typeof value.aid === 'string' &&
      (value.pid === null || typeof value.pid === 'string') &&
      Number.isFinite(value.exp) &&
      Number.isFinite(value.iat);
    // A guest token is never a staff preview. Both claims together can only be a forgery attempt.
    if (value.gst && value.pv) return null;
    return valid ? value : null;
  } catch {
    return null;
  }
}

export function verifyPlaybackToken(
  ring: SecretRing,
  token: string,
  options: VerifyOptions = {},
): TokenVerdict {
  const parts = token.split('.');
  if (parts.length !== 4 || parts[0] !== 'v1') return { ok: false, reason: 'invalid' };
  const [version, kid, payload, given] = parts as [string, string, string, string];
  const secret = [ring.current, ring.previous].find((s) => s && kidOf(s) === kid);
  if (!secret) return { ok: false, reason: 'invalid' };
  const expected = Buffer.from(mac(secret, `${version}.${kid}.${payload}`));
  if (!constantTimeEqual(expected, Buffer.from(given))) return { ok: false, reason: 'invalid' };
  const claims = parseClaims(payload);
  if (!claims) return { ok: false, reason: 'invalid' };
  const now = (options.now ?? (() => Date.now() / 1000))();
  if (now > claims.exp + SKEW_SECONDS) return { ok: false, reason: 'expired' };
  if (options.videoId !== undefined && claims.vid !== options.videoId) {
    return { ok: false, reason: 'wrong_video' };
  }
  return { ok: true, claims };
}
