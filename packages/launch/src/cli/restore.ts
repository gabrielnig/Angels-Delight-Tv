import { readFile } from 'node:fs/promises';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createStorage } from '@ad/storage';
import { loadBackupEnvForRestore } from '../backup/env';
import { RestoreRefused, runRestore } from '../backup/restore';
import { nodeRunner } from '../backup/run';
import { parseArgs } from './args';

const USAGE = `Usage: pnpm backup:restore --target db|keys --private-key offline-keys/backup-db-private.pem
                           --target-url postgres://postgres:pw@localhost:5433/ad_scratch [--key latest|db/ad-...enc]
Restores one backup into an existing scratch database. It refuses the live names ad and ad_keys.
Needs BACKUP_S3_ENDPOINT, BACKUP_S3_ACCESS_KEY_ID, BACKUP_S3_SECRET_ACCESS_KEY (and BACKUP_BUCKET). The private key
is read from the file you name and is never stored.`;

const VERIFY: Record<string, string> = {
  db: 'SELECT (SELECT count(*) FROM accounts)::int AS accounts, (SELECT count(*) FROM videos)::int AS videos, (SELECT count(*) FROM settings)::int AS settings',
  keys: 'SELECT (SELECT count(*) FROM user_keys)::int AS user_keys',
};

async function main(): Promise<number> {
  const parsed = parseArgs(process.argv.slice(2), {
    values: ['target', 'private-key', 'target-url', 'key'],
    booleans: [],
  });
  const target = parsed.ok ? parsed.values.target : undefined;
  if (
    !parsed.ok ||
    (target !== 'db' && target !== 'keys') ||
    !parsed.values['private-key'] ||
    !parsed.values['target-url']
  ) {
    console.error(
      parsed.ok ? '--target db|keys, --private-key and --target-url are required' : parsed.error,
    );
    console.error(USAGE);
    return 2;
  }
  let env;
  try {
    env = loadBackupEnvForRestore(process.env);
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Invalid configuration');
    return 2;
  }
  const storage = createStorage({
    driver: 's3',
    bucket: env.bucket,
    endpoint: env.s3Endpoint,
    region: 'auto',
    forcePathStyle: false,
    accessKeyId: env.s3AccessKeyId,
    secretAccessKey: env.s3SecretAccessKey,
  });
  try {
    const report = await runRestore({
      storage,
      runner: nodeRunner,
      workDir: await mkdtemp(join(tmpdir(), 'ad-restore-')),
      target,
      key: parsed.values.key ?? 'latest',
      privateKey: await readFile(resolve(parsed.values['private-key']), 'utf8'),
      targetUrl: parsed.values['target-url'],
      protectedDatabases: ['ad', 'ad_keys'],
      verifySql: VERIFY[target],
    });
    console.log(`Restored ${report.key} into ${report.database}`);
    console.log('Counts to compare with production:', JSON.stringify(report.verify));
    return 0;
  } catch (error) {
    console.error(
      error instanceof RestoreRefused || error instanceof Error ? error.message : 'Restore failed',
    );
    return 1;
  }
}

main().then(
  (code) => process.exit(code),
  (error: unknown) => {
    console.error('restore failed:', error instanceof Error ? error.message : 'unknown error');
    process.exit(1);
  },
);
