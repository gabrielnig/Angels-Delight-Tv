/**
 * Creates the two accounts the video end to end run signs in with: one admin and one verified viewer.
 * Reads the environment written by scripts/e2e-video-up.sh. Development only, never run against a real database.
 */
import { KeyService, PasswordHasher, emailHash, normalizeEmail, seedFirstAdmin } from '@ad/auth';
import { createDb, createPool, schema, withAccount } from '@ad/db';
import { loadWebEnv } from '@ad/config';
import { uuidv7 } from '@ad/shared';
import { ACCOUNTS } from './accounts';

async function main() {
  const env = loadWebEnv();
  if (env.NODE_ENV === 'production') throw new Error('The e2e seed refuses to run in production');
  const owner = createPool(process.env.DATABASE_URL_MIGRATE as string, { max: 2 });
  const keysPool = createPool(env.KEYS_DATABASE_URL, { max: 2 });
  const db = createDb(owner);
  const keys = new KeyService({ keysDb: createDb(keysPool), kek: env.FIELD_KEK });
  const hasher = new PasswordHasher();
  try {
    await seedFirstAdmin(
      { db, keys, hasher, pepper: env.EMAIL_HASH_PEPPER },
      { email: ACCOUNTS.admin.email, password: ACCOUNTS.admin.password },
    );

    const accountId = uuidv7();
    const email = normalizeEmail(ACCOUNTS.viewer.email) as string;
    const passwordHash = await hasher.hash(ACCOUNTS.viewer.password);
    await keys.createForAccount(accountId);
    const emailEnc = await keys.seal(accountId, 'email', email);
    await withAccount(db, { accountId, role: 'viewer' }, (tx) =>
      tx.insert(schema.accounts).values({
        id: accountId,
        emailHash: Buffer.from(emailHash(email, env.EMAIL_HASH_PEPPER)),
        emailEnc,
        passwordHash,
        role: 'viewer',
        emailVerifiedAt: new Date(),
      }),
    );
    process.stdout.write('seeded e2e admin and viewer\n');
  } finally {
    await owner.end();
    await keysPool.end();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${String(error)}\n`);
  process.exit(1);
});
