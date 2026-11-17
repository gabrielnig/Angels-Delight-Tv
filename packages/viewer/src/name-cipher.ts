import { decryptAesGcm, encryptAesGcm } from '@ad/shared';
import type { NameCipher } from './context';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/**
 * AES-256-GCM with the account id as associated data, so a sealed name cannot be moved to another account.
 * One key for every account: used in tests and local development. Production wires the per user key cipher from
 * the crypto package instead (docs/DATA-MODEL.md, user_keys).
 */
export function createAesNameCipher(key: Uint8Array): NameCipher {
  return {
    async seal(accountId, name) {
      return encryptAesGcm(key, encoder.encode(name), encoder.encode(accountId));
    },
    async open(accountId, sealed) {
      return decoder.decode(decryptAesGcm(key, sealed, encoder.encode(accountId)));
    },
  };
}
