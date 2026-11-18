import { join } from 'node:path';
import { createStorage } from '@ad/storage';
import { loadBackupEnv } from '../backup/env';
import { httpPartWriter } from '../import/service-ports';
import { nodeRunner, runBackup } from '../backup/run';
import { parseArgs } from './args';

const USAGE = `Usage: pnpm backup:run [--json]
Reads the BACKUP_* variables (see .env.production.example). Dumps both databases, encrypts each to its public key,
uploads to the backup bucket, applies retention and pings the dead man's switch. Exit code 1 when anything failed.`;

async function main(): Promise<number> {
  const parsed = parseArgs(process.argv.slice(2), { values: [], booleans: ['json'] });
  if (!parsed.ok) {
    console.error(parsed.error);
    console.error(USAGE);
    return 2;
  }
  let env;
  try {
    env = loadBackupEnv(process.env);
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Invalid backup configuration');
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
  const report = await runBackup({
    storage,
    runner: nodeRunner,
    now: () => new Date(),
    localDir: env.localDir,
    workDir: join(env.localDir, '.work'),
    writePart: httpPartWriter,
    retainLocalDays: env.retainLocalDays,
    pingUrl: env.pingUrl,
    ping: async (url) => {
      await fetch(url, { method: 'GET', signal: AbortSignal.timeout(10_000) });
    },
    targets: [
      {
        target: 'db',
        url: env.dbUrl,
        publicKey: env.publicKeyDb,
        keepDaily: env.keepDaily,
        keepWeekly: env.keepWeekly,
      },
      {
        // Keys database backups must not outlive shredded keys: daily only, 14 days at most (SECURITY section 10, D-132).
        target: 'keys',
        url: env.keysDbUrl,
        publicKey: env.publicKeyKeys,
        keepDaily: Math.min(env.keepDaily, 14),
        keepWeekly: 0,
        maxAgeDays: 14,
      },
    ],
  });
  if (parsed.flags.json) console.log(JSON.stringify(report, null, 2));
  else {
    for (const target of report.targets) {
      console.log(
        target.ok
          ? `${target.target}: ${target.key} (${target.bytes} bytes), removed ${target.deletedRemote.length} remote and ${target.deletedLocal.length} local old copies`
          : `${target.target}: FAILED ${target.error}`,
      );
    }
    console.log(report.ok ? 'Backup OK' : 'Backup FAILED');
  }
  return report.ok ? 0 : 1;
}

main().then(
  (code) => process.exit(code),
  (error: unknown) => {
    console.error('backup failed:', error instanceof Error ? error.message : 'unknown error');
    process.exit(1);
  },
);
