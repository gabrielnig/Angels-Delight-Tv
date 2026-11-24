import { decryptAesGcm, encryptAesGcm, hmacSha256 } from '@ad/shared';

const enc = new TextEncoder();
const dec = new TextDecoder();

export type DonorField = 'email' | 'name' | 'message';

/** Bound to the donation and the field, so a sealed value copied to another row or column cannot be opened there. */
const aad = (donationId: string, field: DonorField) => enc.encode(`donation:${field}:${donationId}`);

export const sealDonorField = (kek: Uint8Array, donationId: string, field: DonorField, value: string): Uint8Array =>
  encryptAesGcm(kek, enc.encode(value), aad(donationId, field));

export const openDonorField = (kek: Uint8Array, donationId: string, field: DonorField, sealed: Uint8Array): string =>
  dec.decode(decryptAesGcm(kek, new Uint8Array(sealed), aad(donationId, field)));

/** Lookup hash for rate limits and reports. Keyed, so it cannot be reversed by guessing addresses without the pepper. */
export const donorEmailHash = (pepper: Uint8Array, email: string): Uint8Array =>
  hmacSha256(pepper, `donation-email:${email.trim().toLowerCase()}`);
