import { hmacSha256 } from '@ad/shared';
import { truncateIp, type BucketPolicy, type RateLimiter } from '@ad/security';

/** The request header that carries the Turnstile token of a visitor who was asked to prove they are a person. */
export const TURNSTILE_HEADER = 'x-turnstile-token';

/**
 * Three refusals from one network in ten minutes, then the next guest session asks for a Turnstile check
 * (M40-S11). A token bucket models it: each refusal spends one, and an empty bucket means "ask". It refills on
 * its own, so the check lifts without anyone clearing anything.
 */
export const GUEST_CHALLENGE_POLICY: BucketPolicy = {
  name: 'guest-challenge-ip',
  capacity: 3,
  refillPerSecond: 3 / 600,
};

type Limiter = Pick<RateLimiter, 'consume' | 'peek'>;

/**
 * The address is cut to its network (IPv4 /24, IPv6 /48, SECURITY.md section 11) and keyed with the server
 * secret before it is stored, so the table holds neither a raw address nor something a dictionary can undo.
 */
export function networkSubject(secret: Uint8Array, ip: string, label: string): string {
  const network = truncateIp(ip) ?? 'untrusted';
  return Buffer.from(hmacSha256(secret, Buffer.from(`ad:${label}:${network}`)))
    .toString('hex')
    .slice(0, 32);
}

export interface GuestChallengeDeps {
  limiter: Limiter;
  secret: Uint8Array;
  /** Checks a Turnstile token with Cloudflare. Fails closed. */
  verify: (token: string | undefined, ip: string | null) => Promise<boolean>;
}

/**
 * The escalation behind `PlaybackHttpDeps.guestChallenge`. Counting and asking fail open when the limiter store is
 * down: the session limits already fail closed, and this layer must never be the thing that locks a visitor out.
 */
export function createGuestChallenge(deps: GuestChallengeDeps) {
  return {
    async required(ip: string): Promise<boolean> {
      try {
        const result = await deps.limiter.peek(
          GUEST_CHALLENGE_POLICY,
          networkSubject(deps.secret, ip, 'guest-challenge'),
        );
        return !result.allowed;
      } catch {
        return false;
      }
    },
    async recordDenial(ip: string): Promise<void> {
      try {
        await deps.limiter.consume(
          GUEST_CHALLENGE_POLICY,
          networkSubject(deps.secret, ip, 'guest-challenge'),
        );
      } catch {
        // Best effort.
      }
    },
    async verify(request: Request, ip: string): Promise<boolean> {
      const token = request.headers.get(TURNSTILE_HEADER) ?? undefined;
      return deps.verify(token, ip);
    },
  };
}
