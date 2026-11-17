import { hmacSha256 } from '@ad/shared';
import { z } from 'zod';

const emailSchema = z.string().max(254).email();

/** Trimmed and lowercased. Plus addressing is kept. Returns null for anything that is not a plain address. */
export function normalizeEmail(input: string): string | null {
  const value = input.trim().toLowerCase();
  if (!value || /[\s\r\n<>,;]/.test(value)) return null;
  if (value.split('@').length !== 2) return null;
  const [local = '', domain = ''] = value.split('@');
  if (!local || !domain.includes('.') || domain.startsWith('.') || domain.endsWith('.')) return null;
  return emailSchema.safeParse(value).success ? value : null;
}

/** Lookup hash for `accounts.email_hash`: HMAC-SHA256 of the normalised address, keyed with EMAIL_HASH_PEPPER. */
export function emailHash(normalizedEmail: string, pepper: Uint8Array): Uint8Array {
  return hmacSha256(pepper, `email:${normalizedEmail}`);
}

export function maskEmail(email: string): string {
  const [local = '', domain = ''] = email.split('@');
  return `${local.slice(0, 1)}***@${domain}`;
}
