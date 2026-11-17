import { decryptAesGcm, encryptAesGcm } from '@ad/shared';
import { randomBytes } from 'node:crypto';

export interface Keyring {
  current: Uint8Array;
  previous?: Uint8Array;
}

/** `HLS_KEK` as current and `HLS_KEK_PREVIOUS` (set only during a rotation) as previous. */
export function keyring(current: Uint8Array, previous?: Uint8Array): Keyring {
  return previous ? { current, previous } : { current };
}

/** Stored in video_keys.kek_version. Unwrap tries the current KEK then the previous one, so this stays 1. */
export const KEK_VERSION = 1;

/** One random 16 byte AES-128 key per video (D-009). */
export function generateHlsKey(): Uint8Array {
  return new Uint8Array(randomBytes(16));
}

const aad = (videoId: string) => new TextEncoder().encode(videoId);

export function wrapHlsKey(
  ring: Keyring,
  videoId: string,
  key: Uint8Array,
): { keyWrapped: Buffer; kekVersion: number } {
  if (key.length !== 16) throw new Error('HLS key must be 16 bytes');
  return {
    keyWrapped: Buffer.from(encryptAesGcm(ring.current, key, aad(videoId))),
    kekVersion: KEK_VERSION,
  };
}

/** AES-GCM with the video id as associated data, so a wrapped key cannot be moved to another video. */
export function unwrapHlsKey(ring: Keyring, videoId: string, wrapped: Uint8Array): Uint8Array {
  for (const kek of [ring.current, ring.previous]) {
    if (!kek) continue;
    try {
      return decryptAesGcm(kek, wrapped, aad(videoId));
    } catch {
      // try the next key
    }
  }
  throw new Error('Could not unwrap the HLS key with any configured KEK');
}
