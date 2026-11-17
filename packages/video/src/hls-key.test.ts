import { describe, expect, it } from 'vitest';
import { generateHlsKey, keyring, unwrapHlsKey, wrapHlsKey } from './hls-key';

const kek = (fill: number) => new Uint8Array(32).fill(fill);
const videoId = '0192f0a0-0000-7000-8000-000000000001';

describe('hls keys', () => {
  it('generates 16 random bytes', () => {
    const a = generateHlsKey();
    expect(a).toHaveLength(16);
    expect(Buffer.from(a).equals(Buffer.from(generateHlsKey()))).toBe(false);
  });

  it('wraps and unwraps bound to the video id', () => {
    const key = generateHlsKey();
    const ring = keyring(kek(1));
    const wrapped = wrapHlsKey(ring, videoId, key);
    expect(wrapped.keyWrapped.length).toBeGreaterThan(16);
    expect(Buffer.from(unwrapHlsKey(ring, videoId, wrapped.keyWrapped))).toEqual(Buffer.from(key));
    expect(() =>
      unwrapHlsKey(ring, '0192f0a0-0000-7000-8000-000000000002', wrapped.keyWrapped),
    ).toThrow();
  });

  it('still unwraps after a KEK rotation using the previous key, and rewraps to the current', () => {
    const key = generateHlsKey();
    const before = wrapHlsKey(keyring(kek(1)), videoId, key);
    const rotated = keyring(kek(2), kek(1));
    expect(Buffer.from(unwrapHlsKey(rotated, videoId, before.keyWrapped))).toEqual(
      Buffer.from(key),
    );
    const after = wrapHlsKey(rotated, videoId, key);
    expect(() => unwrapHlsKey(keyring(kek(1)), videoId, after.keyWrapped)).toThrow();
    expect(Buffer.from(unwrapHlsKey(keyring(kek(2)), videoId, after.keyWrapped))).toEqual(
      Buffer.from(key),
    );
  });

  it('fails closed when no KEK matches', () => {
    const wrapped = wrapHlsKey(keyring(kek(1)), videoId, generateHlsKey());
    expect(() => unwrapHlsKey(keyring(kek(9)), videoId, wrapped.keyWrapped)).toThrow(/unwrap/i);
  });
});
