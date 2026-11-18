import { schema, withAccount, type Database } from '@ad/db';
import { uuidv7 } from '@ad/shared';
import { and, eq, inArray } from 'drizzle-orm';
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
 * Creates the first Super admin (SECURITY.md section 4, D-125). There is no default or environment supplied
 * password, the caller passes what an operator typed at a prompt, and the seed refuses to run once any Super admin
 * exists. When plain admins exist from before the Super admin role, it points at `promoteToSuperAdmin`.
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
    .where(
      and(
        inArray(schema.accounts.role, ['admin', 'super_admin']),
        eq(schema.accounts.status, 'active'),
      ),
    )
    .limit(1);
  if (existing.length > 0) {
    const [sup] = await deps.db
      .select({ id: schema.accounts.id })
      .from(schema.accounts)
      .where(and(eq(schema.accounts.role, 'super_admin'), eq(schema.accounts.status, 'active')))
      .limit(1);
    throw new SeedRefused(
      sup
        ? 'A Super admin already exists, the seed will not run again'
        : 'An admin already exists but no Super admin does. Run the promote command to make that admin a Super admin',
    );
  }

  const accountId = uuidv7();
  const passwordHash = await deps.hasher.hash(input.password);
  await deps.keys.createForAccount(accountId);
  try {
    const emailEnc = await deps.keys.seal(accountId, 'email', email);
    await withAccount(deps.db, { accountId, role: 'super_admin' }, (tx) =>
      tx.insert(schema.accounts).values({
        id: accountId,
        emailHash: Buffer.from(emailHash(email, deps.pepper)),
        emailEnc,
        passwordHash,
        role: 'super_admin',
        emailVerifiedAt: new Date(),
      }),
    );
  } catch (error) {
    await deps.keys.destroy(accountId).catch(() => undefined);
    throw error;
  }
  return { accountId, email };
}

/**
 * For installs that already had admins before the Super admin role (D-125): makes one named, active admin the
 * Super admin. It refuses once any Super admin exists and only ever promotes an account that is already an admin.
 */
export async function promoteToSuperAdmin(
  deps: SeedDeps,
  input: { email: string },
): Promise<{ accountId: string }> {
  const email = normalizeEmail(input.email);
  if (!email) throw new SeedRefused('That is not a valid email address');
  const [sup] = await deps.db
    .select({ id: schema.accounts.id })
    .from(schema.accounts)
    .where(and(eq(schema.accounts.role, 'super_admin'), eq(schema.accounts.status, 'active')))
    .limit(1);
  if (sup) throw new SeedRefused('A Super admin already exists, nothing was changed');
  const [found] = await deps.db
    .select({ id: schema.accounts.id, role: schema.accounts.role, status: schema.accounts.status })
    .from(schema.accounts)
    .where(eq(schema.accounts.emailHash, Buffer.from(emailHash(email, deps.pepper))));
  if (!found || found.role !== 'admin' || found.status !== 'active')
    throw new SeedRefused('No active admin has that address');
  await deps.db
    .update(schema.accounts)
    .set({ role: 'super_admin' })
    .where(eq(schema.accounts.id, found.id));
  return { accountId: found.id };
}
