import { emailHash, normalizeEmail } from '@ad/auth';
import { schema, type Database } from '@ad/db';
import { eq } from 'drizzle-orm';

export type SuppressionReason = 'bounce' | 'complaint';

export interface SuppressionStore {
  isSuppressed(address: string): Promise<boolean>;
  suppress(address: string, reason: SuppressionReason): Promise<void>;
}

/** The bounce and complaint list (M21-S01 AC2). Keyed by the same HMAC as account lookup, so no address is stored. */
export function createSuppressionStore(db: Database, pepper: Uint8Array): SuppressionStore {
  const keyOf = (address: string): string | null => {
    const normalized = normalizeEmail(address);
    return normalized ? Buffer.from(emailHash(normalized, pepper)).toString('hex') : null;
  };
  return {
    async isSuppressed(address) {
      const key = keyOf(address);
      if (!key) return false;
      const rows = await db
        .select({ key: schema.emailSuppressions.emailHash })
        .from(schema.emailSuppressions)
        .where(eq(schema.emailSuppressions.emailHash, key))
        .limit(1);
      return rows.length > 0;
    },
    async suppress(address, reason) {
      const key = keyOf(address);
      if (!key) return;
      await db
        .insert(schema.emailSuppressions)
        .values({ emailHash: key, reason })
        .onConflictDoNothing();
    },
  };
}
