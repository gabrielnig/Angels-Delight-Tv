import { schema, withAccount, type Database } from '@ad/db';
import { and, desc, eq, gt, isNotNull, isNull, lte, or } from 'drizzle-orm';
import { generateToken, hashToken } from './tokens';

type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];

export interface TrustedDeviceView {
  id: string;
  label: string;
  country: string | null;
  createdAt: Date;
  lastUsedAt: Date | null;
  expiresAt: Date;
}

/**
 * Staff browsers remembered after the emailed code (D-397). The cookie holds a random token, the table holds its
 * SHA-256 and the account it was made for, so a token copied to another account finds nothing. Every read and write
 * runs under row level security for that account.
 */
export class TrustedDevices {
  constructor(
    private readonly db: Database,
    private readonly clock: () => Date,
  ) {}

  private as<T>(accountId: string, work: (tx: Tx) => Promise<T>) {
    return withAccount(this.db, { accountId, role: 'viewer' }, work);
  }

  async remember(
    accountId: string,
    input: { label: string; country: string | null; days: number },
  ): Promise<{ token: string; maxAgeSeconds: number }> {
    const token = generateToken();
    const now = this.clock();
    const maxAgeSeconds = input.days * 86400;
    await this.as(accountId, async (tx) => {
      await tx
        .delete(schema.trustedDevices)
        .where(
          and(
            eq(schema.trustedDevices.accountId, accountId),
            or(lte(schema.trustedDevices.expiresAt, now), isNotNull(schema.trustedDevices.revokedAt)),
          ),
        );
      await tx.insert(schema.trustedDevices).values({
        accountId,
        tokenHash: Buffer.from(hashToken(token)),
        label: input.label,
        country: input.country,
        createdAt: now,
        expiresAt: new Date(now.getTime() + maxAgeSeconds * 1000),
      });
    });
    return { token, maxAgeSeconds };
  }

  /** The id of a live remembered device of this account for this token, and records the use. */
  async recognise(accountId: string, token: string | null | undefined): Promise<string | null> {
    if (!token || token.length > 64) return null;
    const now = this.clock();
    return this.as(accountId, async (tx) => {
      const [row] = await tx
        .update(schema.trustedDevices)
        .set({ lastUsedAt: now })
        .where(
          and(
            eq(schema.trustedDevices.accountId, accountId),
            eq(schema.trustedDevices.tokenHash, Buffer.from(hashToken(token))),
            isNull(schema.trustedDevices.revokedAt),
            gt(schema.trustedDevices.expiresAt, now),
          ),
        )
        .returning({ id: schema.trustedDevices.id });
      return row?.id ?? null;
    });
  }

  async list(accountId: string): Promise<TrustedDeviceView[]> {
    const now = this.clock();
    return this.as(accountId, (tx) =>
      tx
        .select({
          id: schema.trustedDevices.id,
          label: schema.trustedDevices.label,
          country: schema.trustedDevices.country,
          createdAt: schema.trustedDevices.createdAt,
          lastUsedAt: schema.trustedDevices.lastUsedAt,
          expiresAt: schema.trustedDevices.expiresAt,
        })
        .from(schema.trustedDevices)
        .where(
          and(
            eq(schema.trustedDevices.accountId, accountId),
            isNull(schema.trustedDevices.revokedAt),
            gt(schema.trustedDevices.expiresAt, now),
          ),
        )
        .orderBy(desc(schema.trustedDevices.createdAt)),
    );
  }

  async revoke(accountId: string, id: string): Promise<boolean> {
    const rows = await this.as(accountId, (tx) =>
      tx
        .update(schema.trustedDevices)
        .set({ revokedAt: this.clock() })
        .where(
          and(
            eq(schema.trustedDevices.id, id),
            eq(schema.trustedDevices.accountId, accountId),
            isNull(schema.trustedDevices.revokedAt),
          ),
        )
        .returning({ id: schema.trustedDevices.id }),
    );
    return rows.length > 0;
  }

  async revokeAll(accountId: string): Promise<void> {
    await this.as(accountId, (tx) =>
      tx
        .update(schema.trustedDevices)
        .set({ revokedAt: this.clock() })
        .where(
          and(eq(schema.trustedDevices.accountId, accountId), isNull(schema.trustedDevices.revokedAt)),
        ),
    );
  }
}
