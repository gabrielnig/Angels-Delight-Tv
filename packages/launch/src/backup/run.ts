import { spawn } from 'node:child_process';
import { mkdir, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import type { StorageAdapter } from '@ad/storage';
import type { PartWriter } from '../import/service-ports';
import { encryptBackupFile } from './crypto';
import { backupKey, parseBackupKey, selectExpired, type BackupTarget } from './retention';
import { uploadFile } from './upload';

export type CommandRunner = (
  command: string,
  args: string[],
  env: Record<string, string | undefined>,
) => Promise<{ code: number; stderr: string }>;

export const nodeRunner: CommandRunner = (command, args, env) =>
  new Promise((resolve) => {
    const child = spawn(command, args, {
      env: { ...process.env, ...env },
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    let stderr = '';
    child.stderr.on('data', (chunk: Buffer) => {
      if (stderr.length < 4000) stderr += chunk.toString();
    });
    child.on('error', (error) => resolve({ code: 127, stderr: error.message }));
    child.on('close', (code) => resolve({ code: code ?? 1, stderr }));
  });

export interface BackupTargetConfig {
  target: BackupTarget;
  /** Superuser url: row level security is forced, so only a superuser can read every row. */
  url: string;
  /** PEM or base64 PEM of the public key this dump is encrypted to. */
  publicKey: string;
  retainDays: number;
}

export interface BackupDeps {
  storage: StorageAdapter;
  runner: CommandRunner;
  now: () => Date;
  /** Encrypted copies kept on the server for a few days. */
  localDir: string;
  /** Scratch space for the plain dump. Emptied after every target. */
  workDir: string;
  writePart: PartWriter;
  targets: BackupTargetConfig[];
  retainLocalDays: number;
  /** Always keep this many newest remote copies per target. Default 3. */
  minKeep?: number;
  pingUrl?: string;
  ping?: (url: string) => Promise<void>;
}

export interface TargetReport {
  target: BackupTarget;
  ok: boolean;
  key?: string;
  bytes?: number;
  deletedRemote: string[];
  deletedLocal: string[];
  error?: string;
}

export interface BackupReport {
  ok: boolean;
  takenAt: string;
  targets: TargetReport[];
}

/** libpq reads the credentials from the environment, so they never appear in a process list or a log line. */
export function pgEnv(url: string): Record<string, string> {
  const parsed = new URL(url);
  return {
    PGHOST: parsed.hostname,
    PGPORT: parsed.port || '5432',
    PGUSER: decodeURIComponent(parsed.username),
    PGPASSWORD: decodeURIComponent(parsed.password),
    PGDATABASE: parsed.pathname.replace(/^\//, ''),
  };
}

const LOCAL_NAME = /^(ad|ad_keys)-\d{8}T\d{6}Z\.dump\.enc$/;

async function backupOne(
  deps: BackupDeps,
  config: BackupTargetConfig,
  takenAt: Date,
): Promise<TargetReport> {
  const report: TargetReport = {
    target: config.target,
    ok: false,
    deletedRemote: [],
    deletedLocal: [],
  };
  const key = backupKey(config.target, takenAt);
  const name = key.split('/')[1]!;
  const plain = join(deps.workDir, `${config.target}.dump`);
  const encrypted = join(deps.localDir, name);
  try {
    const env = pgEnv(config.url);
    const dump = await deps.runner('pg_dump', ['--format=custom', `--file=${plain}`], env);
    if (dump.code !== 0) throw new Error(`pg_dump failed (exit ${dump.code})`);
    const check = await deps.runner('pg_restore', ['--list', plain], {});
    if (check.code !== 0)
      throw new Error('The dump could not be read back (pg_restore --list failed)');

    await encryptBackupFile(plain, encrypted, config.publicKey);
    report.bytes = await uploadFile(deps.storage, key, encrypted, { writePart: deps.writePart });
    report.key = key;

    // Local retention: encrypted copies only, by the time in the name.
    const local = (await readdir(deps.localDir)).filter((file) => LOCAL_NAME.test(file));
    const expiredLocal = selectExpired(
      local.map((file) => ({ key: `${config.target}/${file}`, file })),
      { target: config.target, maxAgeDays: deps.retainLocalDays, minKeep: 1 },
      takenAt,
    );
    for (const item of expiredLocal) {
      await rm(join(deps.localDir, item.file), { force: true });
      report.deletedLocal.push(item.file);
    }

    // Remote retention.
    const remote = await deps.storage.list(`${config.target}/`);
    const expiredRemote = selectExpired(
      remote,
      { target: config.target, maxAgeDays: config.retainDays, minKeep: deps.minKeep ?? 3 },
      takenAt,
    );
    for (const item of expiredRemote) {
      await deps.storage.delete(item.key);
      report.deletedRemote.push(item.key);
    }
    report.ok = true;
  } catch (error) {
    report.error = error instanceof Error ? error.message : 'Unknown error';
    if (report.key) await deps.storage.delete(report.key).catch(() => undefined);
    await rm(encrypted, { force: true });
  } finally {
    await rm(plain, { force: true });
  }
  return report;
}

/**
 * Nightly job: for each database a custom format pg_dump, checked, encrypted to the owner's public key, uploaded to the
 * backup bucket and verified, then old copies are removed. The dead man's switch is pinged only when everything worked.
 */
export async function runBackup(deps: BackupDeps): Promise<BackupReport> {
  const takenAt = deps.now();
  await mkdir(deps.localDir, { recursive: true, mode: 0o700 });
  await mkdir(deps.workDir, { recursive: true, mode: 0o700 });
  const targets: TargetReport[] = [];
  for (const config of deps.targets) targets.push(await backupOne(deps, config, takenAt));
  const ok = targets.every((target) => target.ok);
  if (ok && deps.pingUrl && deps.ping) {
    await deps.ping(deps.pingUrl).catch(() => undefined);
  }
  return { ok, takenAt: takenAt.toISOString(), targets };
}

export { parseBackupKey };
