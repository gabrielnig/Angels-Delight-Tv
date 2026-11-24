import { describe, expect, it } from 'vitest';
import { PENDING_MFA_SECONDS, readPendingMfa, signPendingMfa } from './mfa-pending';

const pepper = new Uint8Array(32).fill(3);
const id = '0197a1f0-0000-7000-8000-000000000001';

describe('pending two step token', () => {
  it('round trips the account while it is fresh', () => {
    const now = Date.parse('2026-03-01T10:00:00Z');
    const token = signPendingMfa(pepper, id, now);
    expect(readPendingMfa(pepper, token, now + 60_000)).toEqual({ accountId: id });
  });

  it('expires after ten minutes', () => {
    const now = Date.parse('2026-03-01T10:00:00Z');
    const token = signPendingMfa(pepper, id, now);
    expect(PENDING_MFA_SECONDS).toBe(600);
    expect(readPendingMfa(pepper, token, now + 601_000)).toBeNull();
  });

  it('refuses a changed account, a wrong key and garbage', () => {
    const now = Date.parse('2026-03-01T10:00:00Z');
    const token = signPendingMfa(pepper, id, now);
    const other = token.replace(id, '0197a1f0-0000-7000-8000-000000000002');
    expect(readPendingMfa(pepper, other, now)).toBeNull();
    expect(readPendingMfa(new Uint8Array(32).fill(4), token, now)).toBeNull();
    expect(readPendingMfa(pepper, 'nonsense', now)).toBeNull();
    expect(readPendingMfa(pepper, '', now)).toBeNull();
  });
});
