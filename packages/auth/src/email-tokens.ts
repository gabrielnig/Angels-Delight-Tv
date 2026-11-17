import { schema, type Database } from '@ad/db';
import type { TokenPurpose } from '@ad/shared';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { constantTimeEqual } from '@ad/shared';
import { generateCode, generateToken, hashCode, hashToken } from './tokens';

type Db = Pick<Database, 'select' | 'insert' | 'update' | 'execute'>;

export interface IssueInput {
  accountId: string;
  purpose: TokenPurpose;
  ttlSeconds: number;
  withCode?: boolean;
  newEmail?: { enc: Buffer; hash: Uint8Array };
  ipTrunc?: string | null;
  now: Date;
  pepper: Uint8Array;
}

/** Creates a token (and optionally a six digit code) and voids earlier unused ones of the same purpose. */
export async function issueEmailToken(
  db: Db,
  input: IssueInput,
): Promise<{ token: string; code: string | null; id: string }> {
  await voidEmailTokens(db, input.accountId, input.purpose, input.now);
  const token = generateToken();
  const [row] = await db
    .insert(schema.emailTokens)
    .values({
      accountId: input.accountId,
      purpose: input.purpose,
      tokenHash: Buffer.from(hashToken(token)),
      newEmailEnc: input.newEmail?.enc ?? null,
      newEmailHash: input.newEmail ? Buffer.from(input.newEmail.hash) : null,
      expiresAt: new Date(input.now.getTime() + input.ttlSeconds * 1000),
      createdAt: input.now,
      ipTrunc: input.ipTrunc ?? null,
    })
    .returning({ id: schema.emailTokens.id });
  if (!row) throw new Error('Token insert returned no row');
  let code: string | null = null;
  if (input.withCode) {
    code = generateCode();
    await db.insert(schema.verificationCodes).values({
      tokenId: row.id,
      codeHash: Buffer.from(hashCode(input.pepper, input.accountId, code)),
    });
  }
  return { token, code, id: row.id };
}

export async function voidEmailTokens(
  db: Db,
  accountId: string,
  purpose: TokenPurpose,
  now: Date,
): Promise<void> {
  await db
    .update(schema.emailTokens)
    .set({ usedAt: now })
    .where(
      and(
        eq(schema.emailTokens.accountId, accountId),
        eq(schema.emailTokens.purpose, purpose),
        isNull(schema.emailTokens.usedAt),
      ),
    );
}

export type EmailTokenRow = typeof schema.emailTokens.$inferSelect;

export async function findEmailToken(db: Db, token: string): Promise<EmailTokenRow | null> {
  if (!token || token.length > 64) return null;
  const [row] = await db
    .select()
    .from(schema.emailTokens)
    .where(eq(schema.emailTokens.tokenHash, Buffer.from(hashToken(token))));
  return row ?? null;
}

export type CodeCheck =
  { status: 'ok'; token: EmailTokenRow } | { status: 'invalid' | 'expired' | 'too_many' };

/**
 * Checks a six digit code against the newest unused token for the account. Wrong guesses are counted on the
 * code, and at the limit the code stops working until a new one is sent (M01-S03).
 */
export async function checkCode(
  db: Pick<Database, 'transaction'>,
  input: {
    accountId: string;
    purpose: TokenPurpose;
    code: string;
    now: Date;
    ttlSeconds: number;
    maxAttempts: number;
    pepper: Uint8Array;
  },
): Promise<CodeCheck> {
  if (!/^\d{6}$/.test(input.code)) return { status: 'invalid' };
  return db.transaction(async (tx) => {
    const result = await tx.execute<{
      id: string;
      attempts: number;
      code_hash: Buffer;
      created_at: Date;
    }>(
      sql`SELECT t.id, c.attempts, c.code_hash, t.created_at
          FROM email_tokens t JOIN verification_codes c ON c.token_id = t.id
          WHERE t.account_id = ${input.accountId} AND t.purpose = ${input.purpose} AND t.used_at IS NULL
          ORDER BY t.created_at DESC LIMIT 1 FOR UPDATE OF c`,
    );
    const row = result.rows[0];
    if (!row) return { status: 'invalid' as const };
    if (Number(row.attempts) >= input.maxAttempts) return { status: 'too_many' as const };
    if (input.now.getTime() > new Date(row.created_at).getTime() + input.ttlSeconds * 1000) {
      return { status: 'expired' as const };
    }
    const expected = hashCode(input.pepper, input.accountId, input.code);
    if (!constantTimeEqual(new Uint8Array(row.code_hash), expected)) {
      const attempts = Number(row.attempts) + 1;
      await tx
        .update(schema.verificationCodes)
        .set({ attempts })
        .where(eq(schema.verificationCodes.tokenId, row.id));
      return {
        status: attempts >= input.maxAttempts ? ('too_many' as const) : ('invalid' as const),
      };
    }
    const [token] = await tx
      .select()
      .from(schema.emailTokens)
      .where(eq(schema.emailTokens.id, row.id));
    return token ? { status: 'ok' as const, token } : { status: 'invalid' as const };
  });
}

export async function latestToken(
  db: Db,
  accountId: string,
  purpose: TokenPurpose,
): Promise<EmailTokenRow | null> {
  const [row] = await db
    .select()
    .from(schema.emailTokens)
    .where(
      and(eq(schema.emailTokens.accountId, accountId), eq(schema.emailTokens.purpose, purpose)),
    )
    .orderBy(desc(schema.emailTokens.createdAt))
    .limit(1);
  return row ?? null;
}
