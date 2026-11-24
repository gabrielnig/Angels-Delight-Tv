import { describe, expect, it, vi } from 'vitest';
import {
  createGuestChallenge,
  GUEST_CHALLENGE_POLICY,
  networkSubject,
  TURNSTILE_HEADER,
} from './challenge';

const secret = new Uint8Array(32).fill(7);

function fakeLimiter(tokens = 3) {
  const subjects: string[] = [];
  return {
    subjects,
    state: { tokens },
    consume: vi.fn(async (_policy: unknown, subject: string) => {
      subjects.push(subject);
      return { allowed: true, remaining: 0, retryAfterSeconds: 0 };
    }),
    peek: vi.fn(async (_policy: unknown, subject: string) => {
      subjects.push(subject);
      return { allowed: tokens > 0, remaining: tokens, retryAfterSeconds: 60 };
    }),
  };
}

const req = (headers: Record<string, string> = {}) =>
  new Request('https://app.test/api/play/x/session', { method: 'POST', headers });

describe('guest challenge (M40-S11)', () => {
  it('allows three denials in ten minutes before it asks', () => {
    expect(GUEST_CHALLENGE_POLICY.capacity).toBe(3);
    expect(GUEST_CHALLENGE_POLICY.refillPerSecond).toBeCloseTo(3 / 600);
  });

  it('is not required while the address has denials to spare', async () => {
    const challenge = createGuestChallenge({
      limiter: fakeLimiter(2) as never,
      secret,
      verify: async () => true,
    });
    expect(await challenge.required('203.0.113.5')).toBe(false);
  });

  it('is required once the denial allowance is used up', async () => {
    const challenge = createGuestChallenge({
      limiter: fakeLimiter(0) as never,
      secret,
      verify: async () => true,
    });
    expect(await challenge.required('203.0.113.5')).toBe(true);
  });

  it('keys the address by a keyed hash of its network, never the raw address', async () => {
    const limiter = fakeLimiter();
    const challenge = createGuestChallenge({
      limiter: limiter as never,
      secret,
      verify: async () => true,
    });
    await challenge.recordDenial('203.0.113.5');
    await challenge.required('203.0.113.77');
    await challenge.required('198.51.100.1');
    const [first, second, third] = limiter.subjects;
    expect(first).toMatch(/^[0-9a-f]{32}$/);
    expect(first).toBe(second);
    expect(third).not.toBe(first);
    expect(limiter.subjects.join()).not.toContain('203.0.113');
  });

  it('fails open when the limiter store is down, so a visitor is never locked out by the counter', async () => {
    const limiter = {
      peek: async () => {
        throw new Error('down');
      },
      consume: async () => {
        throw new Error('down');
      },
    };
    const challenge = createGuestChallenge({
      limiter: limiter as never,
      secret,
      verify: async () => true,
    });
    expect(await challenge.required('203.0.113.5')).toBe(false);
    await expect(challenge.recordDenial('203.0.113.5')).resolves.toBeUndefined();
  });

  it('verifies the token from the header with the address, and fails closed without one', async () => {
    const verify = vi.fn(async (token: string | undefined) => token === 'good');
    const challenge = createGuestChallenge({ limiter: fakeLimiter() as never, secret, verify });
    expect(await challenge.verify(req({ [TURNSTILE_HEADER]: 'good' }), '203.0.113.5')).toBe(true);
    expect(verify).toHaveBeenCalledWith('good', '203.0.113.5');
    expect(await challenge.verify(req({ [TURNSTILE_HEADER]: 'bad' }), '203.0.113.5')).toBe(false);
    expect(await challenge.verify(req(), '203.0.113.5')).toBe(false);
  });

  it('gives each purpose its own subject for the same network, and the same /24 the same subject', () => {
    const a = networkSubject(secret, '203.0.113.5', 'guest-session');
    expect(a).toBe(networkSubject(secret, '203.0.113.200', 'guest-session'));
    expect(a).not.toBe(networkSubject(secret, '203.0.113.5', 'guest-challenge'));
    expect(a).not.toBe(networkSubject(new Uint8Array(32).fill(8), '203.0.113.5', 'guest-session'));
  });
});
