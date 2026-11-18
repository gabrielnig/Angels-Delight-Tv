import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { StorageAdapter } from '@ad/storage';
import pg from 'pg';
import { decryptBackupFile } from './crypto';
import { manifestKey, parseManifest, sha256Hex } from './manifest';
import { pgEnv, type CommandRunner } from './run';
import { parseBackupKey, type BackupTarget } from './retention';

export class RestoreRefused extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RestoreRefused';
  }
}

export interface RestoreDeps {
  storage: StorageAdapter;
  runner: CommandRunner;
  workDir: string;
  target: BackupTarget;
  /** A full backup key, or `latest`. */
  key: string;
  /** PEM of the private key kept offline by the owner. Read from a file by the caller, never from the server env. */
  privateKey: string;
  /** Superuser url of the database to restore into. It must already exist and should be empty. */
  targetUrl: string;
  /** Database names a restore must never overwrite by accident. */
  protectedDatabases: string[];
  /** Optional query that returns one row, for example counts, to compare with production. */
  verifySql?: string;
}

export interface RestoreReport {
  key: string;
  database: string;
  verify?: Record<string, unknown>;
}

/**
 * When the backup has a manifest, the stored bytes must match its size and checksum before anything is decrypted. A backup
 * from before manifests existed has none and is restored as before.
 */
async function verifyAgainstManifest(
  storage: StorageAdapter,
  key: string,
  stored: Buffer,
): Promise<void> {
  if (!(await storage.head(manifestKey(key)))) return;
  const text: Buffer[] = [];
  for await (const chunk of await storage.get(manifestKey(key))) text.push(Buffer.from(chunk));
  const manifest = parseManifest(Buffer.concat(text).toString());
  if (!manifest || manifest.key !== key)
    throw new RestoreRefused('The backup manifest is unreadable. Do not restore from this copy.');
  if (manifest.bytes !== stored.length || manifest.sha256 !== sha256Hex(stored))
    throw new RestoreRefused(
      'The backup does not match its manifest (size or checksum). Do not restore from this copy.',
    );
}

/**
 * Restores one encrypted backup into a database. Used for the rehearsal before launch and the quarterly drill: restore
 * into a scratch database, start the app against it, sign in, play a video. Refuses the live database names.
 */
export async function runRestore(deps: RestoreDeps): Promise<RestoreReport> {
  const env = pgEnv(deps.targetUrl);
  if (deps.protectedDatabases.includes(env.PGDATABASE!)) {
    throw new RestoreRefused(
      `Refusing to restore over ${env.PGDATABASE}. Restore into a scratch database, or follow the production restore steps in docs/LAUNCH-RUNBOOK.md.`,
    );
  }
  let key = deps.key;
  if (key === 'latest') {
    const found = (await deps.storage.list(`${deps.target}/`))
      .map((object) => ({ key: object.key, parsed: parseBackupKey(object.key) }))
      .filter((entry) => entry.parsed?.target === deps.target)
      .sort((a, b) => b.parsed!.takenAt.getTime() - a.parsed!.takenAt.getTime());
    if (found.length === 0)
      throw new RestoreRefused(`No ${deps.target} backups were found in the backup bucket`);
    key = found[0]!.key;
  } else if (!parseBackupKey(key)) {
    throw new RestoreRefused('That is not a backup name');
  }

  await mkdir(deps.workDir, { recursive: true, mode: 0o700 });
  const encrypted = join(deps.workDir, 'backup.enc');
  const plain = join(deps.workDir, 'backup.dump');
  try {
    const chunks: Buffer[] = [];
    for await (const chunk of await deps.storage.get(key)) chunks.push(Buffer.from(chunk));
    const stored = Buffer.concat(chunks);
    await verifyAgainstManifest(deps.storage, key, stored);
    await writeFile(encrypted, stored, { mode: 0o600 });
    await decryptBackupFile(encrypted, plain, deps.privateKey);
    const restored = await deps.runner(
      'pg_restore',
      ['--exit-on-error', `--dbname=${env.PGDATABASE}`, plain],
      env,
    );
    if (restored.code !== 0) throw new Error(`pg_restore failed: ${restored.stderr.slice(0, 500)}`);
  } finally {
    await rm(encrypted, { force: true });
    await rm(plain, { force: true });
  }

  const report: RestoreReport = { key, database: env.PGDATABASE! };
  if (deps.verifySql) {
    const client = new pg.Client({ connectionString: deps.targetUrl });
    await client.connect();
    try {
      report.verify = (await client.query(deps.verifySql)).rows[0] as Record<string, unknown>;
    } finally {
      await client.end();
    }
  }
  return report;
}
