import { schema, withAccount, type Database } from '@ad/db';
import { uuidv7 } from '@ad/shared';
import { and, eq } from 'drizzle-orm';
import { emailHash, normalizeEmail } from './identifiers';
import type { KeyService } from './keys';
import type { PasswordHasher } from './password';
import { checkPassword } from './policy';

export class SeedRefused extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SeedRefused';
  }
}

export interface SeedDeps {
  /** Connection as the owner role (ad_migrator). The app role cannot see other accounts, so it cannot check for an admin. */
  db: Database;
  keys: KeyService;
  hasher: PasswordHasher;
  pepper: Uint8Array;
}

/**
 * Creates the first admin (SECURITY.md section 4). There is no default or environment supplied password, the
 * caller passes what an operator typed at a prompt, and the seed refuses to run once any admin exists.
 */
export async function seedFirstAdmin(
  deps: SeedDeps,
  input: { email: string; password: string },
): Promise<{ accountId: string; email: string }> {
  const email = normalizeEmail(input.email);
  if (!email) throw new SeedRefused('That is not a valid email address');
  const check = checkPassword(input.password, email);
  if (!check.ok) {
    const failed = check.rules.find((rule) => rule.passed !== true);
    throw new SeedRefused(`Password rejected: ${failed?.label ?? 'too weak'}`);
  }
  const existing = await deps.db
    .select({ id: schema.accounts.id })
    .from(schema.accounts)
    .where(and(eq(schema.accounts.role, 'admin'), eq(schema.accounts.status, 'active')))
    .limit(1);
  if (existing.length > 0)
    throw new SeedRefused('An admin already exists, the seed will not run again');

  const accountId = uuidv7();
  const passwordHash = await deps.hasher.hash(input.password);
  await deps.keys.createForAccount(accountId);
  try {
    const emailEnc = await deps.keys.seal(accountId, 'email', email);
    await withAccount(deps.db, { accountId, role: 'admin' }, (tx) =>
      tx.insert(schema.accounts).values({
        id: accountId,
        emailHash: Buffer.from(emailHash(email, deps.pepper)),
        emailEnc,
        passwordHash,
        role: 'admin',
        emailVerifiedAt: new Date(),
      }),
    );
  } catch (error) {
    await deps.keys.destroy(accountId).catch(() => undefined);
    throw error;
  }
  return { accountId, email };
}
