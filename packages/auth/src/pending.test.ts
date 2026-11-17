import { describe, expect, it } from 'vitest';
import { readPending, signPending } from './pending';

const pepper = new Uint8Array(32).fill(2);

describe('pending verification cookie', () => {
  const value = signPending(pepper, { email: 'tobi@example.com', expiresAt: 2_000 });

  it('round trips while it is fresh', () => {
    expect(readPending(pepper, value, 1_000)).toEqual({
      email: 'tobi@example.com',
      expiresAt: 2_000,
    });
  });

  it('expires', () => {
    expect(readPending(pepper, value, 2_001)).toBeNull();
  });

  it('rejects a changed payload, a different key and junk', () => {
    const [, mac] = value.split('.');
    const forged = `${Buffer.from(JSON.stringify({ email: 'victim@example.com', expiresAt: 9_999 })).toString('base64url')}.${mac}`;
    expect(readPending(pepper, forged, 1_000)).toBeNull();
    expect(readPending(new Uint8Array(32).fill(3), value, 1_000)).toBeNull();
    for (const junk of [undefined, '', 'a.b.c', '.', 'x'.repeat(700)]) {
      expect(readPending(pepper, junk, 1_000)).toBeNull();
    }
  });
});
