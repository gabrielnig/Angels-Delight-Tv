import { describe, expect, it } from 'vitest';
import { readNote, signNote } from './note';

const pepper = new Uint8Array(32).fill(3);
const now = Date.parse('2026-03-01T10:00:00Z');

describe('signed oauth notes', () => {
  it('round trips a payload before it expires', () => {
    const token = signNote(pepper, 'oauth', { a: 1, b: 'x' }, 600, now);
    expect(readNote(pepper, 'oauth', token, now + 599_000)).toMatchObject({ a: 1, b: 'x' });
  });

  it('rejects an expired, tampered, foreign or malformed note', () => {
    const token = signNote(pepper, 'oauth', { a: 1 }, 600, now);
    expect(readNote(pepper, 'oauth', token, now + 601_000)).toBeNull();
    const [body, mac] = token.split('.') as [string, string];
    const forged = Buffer.from(
      JSON.stringify({ a: 2, exp: Math.floor(now / 1000) + 600 }),
    ).toString('base64url');
    expect(readNote(pepper, 'oauth', `${forged}.${mac}`, now)).toBeNull();
    expect(readNote(pepper, 'glink', token, now)).toBeNull();
    expect(readNote(new Uint8Array(32).fill(4), 'oauth', token, now)).toBeNull();
    expect(readNote(pepper, 'oauth', body, now)).toBeNull();
    expect(readNote(pepper, 'oauth', 'x'.repeat(5000), now)).toBeNull();
    expect(readNote(pepper, 'oauth', '', now)).toBeNull();
  });
});
