import { createHmac, timingSafeEqual } from 'node:crypto';

const TOKEN_DAYS = 365;

const PURPOSE = 'unsubscribe_notices';

function signingKey(kek: Uint8Array): Buffer {
  return createHmac('sha256', kek).update(`purpose:${PURPOSE}`).digest();
}

/** A stateless token for the unsubscribe link: account, expiry and an HMAC. It opens one door only. */
export function signUnsubscribeToken(kek: Uint8Array, accountId: string, now: Date): string {
  const expires = Math.floor(now.getTime() / 1000) + TOKEN_DAYS * 86_400;
  const payload = Buffer.from(`${PURPOSE}:${accountId}:${expires}`).toString('base64url');
  const sig = createHmac('sha256', signingKey(kek)).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

/** The account id inside a good, unexpired token, else null. */
export function verifyUnsubscribeToken(kek: Uint8Array, token: string, now: Date): string | null {
  const [payload, sig, extra] = token.split('.');
  if (!payload || !sig || extra !== undefined) return null;
  const expected = createHmac('sha256', signingKey(kek)).update(payload).digest();
  const given = Buffer.from(sig, 'base64url');
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  const [purpose, accountId, expires] = Buffer.from(payload, 'base64url').toString('utf8').split(':');
  if (purpose !== PURPOSE || !accountId || !expires) return null;
  if (Number(expires) * 1000 < now.getTime()) return null;
  return accountId;
}

