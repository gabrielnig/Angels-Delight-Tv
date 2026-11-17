import { describe, expect, it } from 'vitest';
import { base32Random, isUuid, mediaPrefix, uuidv7, uuidv7Timestamp } from './ids';

describe('uuidv7', () => {
  it('sets version 7 and the RFC 4122 variant bits', () => {
    const id = uuidv7();
    expect(id[14]).toBe('7');
    expect('89ab').toContain(id[19]);
    expect(isUuid(id)).toBe(true);
  });

  it('encodes the injected clock in the first 48 bits', () => {
    const at = new Date('2026-01-02T03:04:05.678Z').getTime();
    const id = uuidv7({ now: () => at });
    expect(uuidv7Timestamp(id)).toBe(at);
  });

  it('sorts by creation time when ids are minted at increasing times', () => {
    const earlier = uuidv7({ now: () => 1_700_000_000_000 });
    const later = uuidv7({ now: () => 1_700_000_000_001 });
    expect(earlier < later).toBe(true);
  });

  it('is deterministic when the random source is injected', () => {
    const fixed = (n: number) => new Uint8Array(n).fill(0xab);
    const a = uuidv7({ now: () => 1000, random: fixed });
    const b = uuidv7({ now: () => 1000, random: fixed });
    expect(a).toBe(b);
  });

  it('produces distinct ids for the same millisecond with real randomness', () => {
    const at = 1_700_000_000_000;
    expect(uuidv7({ now: () => at })).not.toBe(uuidv7({ now: () => at }));
  });
});

describe('isUuid', () => {
  it('rejects strings that are not uuids', () => {
    expect(isUuid('not-a-uuid')).toBe(false);
    expect(isUuid('')).toBe(false);
  });
});

describe('base32Random', () => {
  it('encodes 16 bytes as 26 lowercase base32 characters', () => {
    const out = base32Random(16);
    expect(out).toMatch(/^[a-z2-7]{26}$/);
  });

  it('matches the RFC 4648 vector for known bytes', () => {
    const bytes = (n: number) => new Uint8Array(n).fill(0);
    expect(base32Random(5, bytes)).toBe('aaaaaaaa');
  });
});

describe('mediaPrefix', () => {
  it('is 128 random bits so it cannot be guessed', () => {
    expect(mediaPrefix()).toMatch(/^[a-z2-7]{26}$/);
    expect(mediaPrefix()).not.toBe(mediaPrefix());
  });
});
