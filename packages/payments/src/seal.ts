import { decryptAesGcm, encryptAesGcm } from '@ad/shared';

/** Bound to the table, so a sealed payload cannot be moved into another column and opened there. */
const AAD = new TextEncoder().encode('payment_events.payload');

export const sealPayload = (kek: Uint8Array) => async (bytes: Uint8Array): Promise<Uint8Array> =>
  encryptAesGcm(kek, bytes, AAD);

export const openPayload = (kek: Uint8Array) => async (bytes: Uint8Array): Promise<Uint8Array> =>
  decryptAesGcm(kek, bytes, AAD);
