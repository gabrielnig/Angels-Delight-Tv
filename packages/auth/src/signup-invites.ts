import { schema, type Database } from '@ad/db';
import { randomInt } from 'node:crypto';
import { and, eq, gt, isNull, or, sql } from 'drizzle-orm';
import { hashToken } from './tokens';
import { InviteRequired } from './types';

type Reader = Pick<Database, 'select'>;
type Writer = Pick<Database, 'update'>;

const hashOf = (normalized: string) => Buffer.from(hashToken(`signup-invite:${normalized}`));

/** The hash stored for a code, or null when the text cannot be a code. */
export function inviteCodeHash(raw: string | undefined | null): Buffer | null {
  const normalized = normalizeCode(raw);
  return normalized ? hashOf(normalized) : null;
}

function normalizeCode(raw: string | undefined | null): string | null {
  const cleaned = (raw ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return cleaned.length === CODE_LENGTH ? cleaned : null;
}

const CODE_LENGTH = 10;
/** No 0, 1, I or O, so a code read aloud or copied by hand is not misread. */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** A new code such as `K7QM-3WTD-RB`: 10 characters from 32, about 50 bits. */
export function generateInviteCode(): string {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i += 1) code += ALPHABET[randomInt(ALPHABET.length)];
  return `${code.slice(0, 4)}-${code.slice(4, 8)}-${code.slice(8)}`;
}

const usable = (now: Date) =>
  and(
    isNull(schema.signupInvites.revokedAt),
    sql`${schema.signupInvites.uses} < ${schema.signupInvites.maxUses}`,
    or(isNull(schema.signupInvites.expiresAt), gt(schema.signupInvites.expiresAt, now)),
  );

/** A read only check used before any work is done. The authoritative check is `consumeInvite`. */
export async function findUsableInvite(
  db: Reader,
  raw: string | undefined | null,
  now: Date,
): Promise<boolean> {
  const hash = inviteCodeHash(raw);
  if (!hash) return false;
  const [row] = await db
    .select({ id: schema.signupInvites.id })
    .from(schema.signupInvites)
    .where(and(eq(schema.signupInvites.codeHash, hash), usable(now)))
    .limit(1);
  return Boolean(row);
}

/**
 * Counts one use in a single conditional update, so concurrent sign ups cannot pass the limit. Run it in the
 * transaction that creates the account. Throws `InviteRequired` when the code is not usable.
 */
export async function consumeInvite(
  tx: Writer,
  raw: string | undefined | null,
  now: Date,
): Promise<string> {
  const hash = inviteCodeHash(raw);
  if (!hash) throw new InviteRequired();
  const [row] = await tx
    .update(schema.signupInvites)
    .set({ uses: sql`${schema.signupInvites.uses} + 1` })
    .where(and(eq(schema.signupInvites.codeHash, hash), usable(now)))
    .returning({ id: schema.signupInvites.id });
  if (!row) throw new InviteRequired();
  return row.id;
}

export type SignupInviteStatus = 'active' | 'used_up' | 'expired' | 'revoked';

export function inviteStatus(
  row: { revokedAt: Date | null; expiresAt: Date | null; uses: number; maxUses: number },
  now: Date,
): SignupInviteStatus {
  if (row.revokedAt) return 'revoked';
  if (row.expiresAt && row.expiresAt <= now) return 'expired';
  if (row.uses >= row.maxUses) return 'used_up';
  return 'active';
}
