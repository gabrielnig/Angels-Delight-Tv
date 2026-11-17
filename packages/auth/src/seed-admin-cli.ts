import { createDb, createPool } from '@ad/db';
import { createInterface } from 'node:readline';
import { Writable } from 'node:stream';
import { z } from 'zod';
import { KeyService } from './keys';
import { PasswordHasher } from './password';
import { seedFirstAdmin, SeedRefused } from './seed-admin';

const key32 = z
  .string()
  .refine(
    (value) => Buffer.from(value, 'base64').length === 32,
    'must be 32 random bytes as base64',
  )
  .transform((value) => new Uint8Array(Buffer.from(value, 'base64')));

const env = z.object({
  DATABASE_URL_MIGRATE: z.string().regex(/^postgres(ql)?:\/\//),
  KEYS_DATABASE_URL: z.string().regex(/^postgres(ql)?:\/\//),
  FIELD_KEK: key32,
  EMAIL_HASH_PEPPER: key32,
});

function ask(question: string, hidden: boolean): Promise<string> {
  const muted = new Writable({
    write(chunk, _encoding, callback) {
      if (!hidden) process.stdout.write(chunk);
      callback();
    },
  });
  const rl = createInterface({ input: process.stdin, output: muted, terminal: true });
  process.stdout.write(question);
  return new Promise((resolve) => {
    rl.question('', (answer) => {
      rl.close();
      if (hidden) process.stdout.write('\n');
      resolve(answer);
    });
  });
}

async function main(): Promise<void> {
  if (!process.stdin.isTTY) {
    throw new SeedRefused(
      'Run this in an interactive terminal. The password is never read from the environment or a pipe.',
    );
  }
  const parsed = env.safeParse(process.env);
  if (!parsed.success) {
    const names = parsed.error.issues.map((issue) => String(issue.path[0])).join(', ');
    throw new SeedRefused(`Missing or invalid environment variables: ${names}`);
  }
  const email = (await ask('Admin email: ', false)).trim();
  const password = await ask('Password (at least 10 characters): ', true);
  const again = await ask('Repeat the password: ', true);
  if (password !== again) throw new SeedRefused('The passwords do not match');

  const pool = createPool(parsed.data.DATABASE_URL_MIGRATE, {
    max: 2,
    applicationName: 'seed-admin',
  });
  const keysPool = createPool(parsed.data.KEYS_DATABASE_URL, {
    max: 2,
    applicationName: 'seed-admin',
  });
  try {
    const result = await seedFirstAdmin(
      {
        db: createDb(pool),
        keys: new KeyService({ keysDb: createDb(keysPool), kek: parsed.data.FIELD_KEK }),
        hasher: new PasswordHasher(),
        pepper: parsed.data.EMAIL_HASH_PEPPER,
      },
      { email, password },
    );
    console.log(
      `Created the first admin ${result.email}. Sign in at /admin/login and set up two factor sign in.`,
    );
  } finally {
    await pool.end();
    await keysPool.end();
  }
}

main().catch((error: unknown) => {
  console.error(
    error instanceof SeedRefused ? error.message : 'Seed failed. Check the database connections.',
  );
  process.exit(1);
});
