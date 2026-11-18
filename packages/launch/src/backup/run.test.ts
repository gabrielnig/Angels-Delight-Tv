import { generateKeyPairSync } from 'node:crypto';
import { mkdtemp, readdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LocalStorage } from '@ad/storage';
import { describe, expect, it } from 'vitest';
import { localPartWriter } from '../import/service-ports';
import { decryptBackupFile } from './crypto';
import { backupKey } from './retention';
import { runBackup, type CommandRunner } from './run';

const secret = new Uint8Array(32).fill(9);
const pair = () =>
  generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

class FakeRunner {
  calls: { command: string; args: string[]; env: Record<string, string | undefined> }[] = [];
  failDump: string | null = null;
  run: CommandRunner = async (command, args, env) => {
    this.calls.push({ command, args, env });
    if (command === 'pg_dump') {
      const file = args.find((a) => a.startsWith('--file='))!.slice(7);
      if (this.failDump && env.PGDATABASE === this.failDump)
        return { code: 1, stderr: 'connection refused' };
      await writeFile(file, `DUMP of ${env.PGDATABASE}`);
    }
    return { code: 0, stderr: '' };
  };
}

async function setup() {
  const root = await mkdtemp(join(tmpdir(), 'ad-backup-run-'));
  const storage = new LocalStorage({
    root: join(root, 'r2'),
    bucket: 'ad-backups',
    signingSecret: secret,
  });
  const dbKeys = pair();
  const keysKeys = pair();
  const pings: string[] = [];
  const runner = new FakeRunner();
  const now = new Date('2026-11-18T02:30:00Z');
  const deps = {
    storage,
    runner: runner.run,
    now: () => now,
    localDir: join(root, 'local'),
    workDir: join(root, 'work'),
    writePart: localPartWriter(storage, secret),
    ping: async (url: string) => void pings.push(url),
    pingUrl: 'https://monitor.example/ping/abc',
    targets: [
      {
        target: 'db' as const,
        url: 'postgres://postgres:pw@postgres:5432/ad',
        publicKey: dbKeys.publicKey,
        retainDays: 35,
      },
      {
        target: 'keys' as const,
        url: 'postgres://postgres:pw@postgres:5432/ad_keys',
        publicKey: keysKeys.publicKey,
        retainDays: 14,
      },
    ],
    retainLocalDays: 7,
  };
  return { root, storage, dbKeys, keysKeys, pings, runner, deps, now };
}

describe('runBackup', () => {
  it('dumps both databases, encrypts each with its own key, uploads, verifies and pings', async () => {
    const s = await setup();
    const report = await runBackup(s.deps);
    expect(report.ok).toBe(true);
    expect(report.targets.map((t) => t.key)).toEqual([
      backupKey('db', s.now),
      backupKey('keys', s.now),
    ]);
    expect(s.pings).toEqual(['https://monitor.example/ping/abc']);

    const stored = await s.storage.list('');
    expect(stored.map((o) => o.key).sort()).toEqual(
      [backupKey('db', s.now), backupKey('keys', s.now)].sort(),
    );

    // Each opens only with its own private key and holds that database's dump.
    const work = await mkdtemp(join(tmpdir(), 'ad-backup-check-'));
    const chunks: Buffer[] = [];
    for await (const c of await s.storage.get(backupKey('db', s.now))) chunks.push(Buffer.from(c));
    await writeFile(join(work, 'db.enc'), Buffer.concat(chunks));
    await decryptBackupFile(join(work, 'db.enc'), join(work, 'db.out'), s.dbKeys.privateKey);
    expect((await readFile(join(work, 'db.out'))).toString()).toBe('DUMP of ad');
    await expect(
      decryptBackupFile(join(work, 'db.enc'), join(work, 'x'), s.keysKeys.privateKey),
    ).rejects.toThrow();
  });

  it('passes credentials through the environment, never on the command line', async () => {
    const s = await setup();
    await runBackup(s.deps);
    const dump = s.runner.calls.find((c) => c.command === 'pg_dump')!;
    expect(dump.args.join(' ')).not.toContain('pw');
    expect(dump.env).toMatchObject({
      PGHOST: 'postgres',
      PGPORT: '5432',
      PGUSER: 'postgres',
      PGPASSWORD: 'pw',
      PGDATABASE: 'ad',
    });
    expect(dump.args).toContain('--format=custom');
  });

  it('checks the dump is readable before encrypting it', async () => {
    const s = await setup();
    await runBackup(s.deps);
    expect(
      s.runner.calls.some((c) => c.command === 'pg_restore' && c.args.includes('--list')),
    ).toBe(true);
  });

  it('keeps a local copy and removes only local copies older than the local window', async () => {
    const s = await setup();
    await runBackup({ ...s.deps, now: () => new Date('2026-11-01T02:30:00Z') });
    const second = await runBackup({ ...s.deps, now: () => new Date('2026-11-17T02:30:00Z') });
    await runBackup(s.deps);
    const left = (await readdir(join(s.root, 'local'))).sort();
    expect(left).toEqual([
      'ad-20261117T023000Z.dump.enc',
      'ad-20261118T023000Z.dump.enc',
      'ad_keys-20261117T023000Z.dump.enc',
      'ad_keys-20261118T023000Z.dump.enc',
    ]);
    expect(second.targets[0]!.deletedLocal).toEqual(['ad-20261101T023000Z.dump.enc']);
  });

  it('applies remote retention per target and never deletes the newest copies', async () => {
    const s = await setup();
    for (const days of [100, 90, 80, 40, 2]) {
      await runBackup({ ...s.deps, now: () => new Date(s.now.getTime() - days * 86_400_000) });
    }
    await runBackup(s.deps);
    const at = (days: number) => new Date(s.now.getTime() - days * 86_400_000);
    const keys = (await s.storage.list('')).map((o) => o.key).sort();
    // The newest three of each target stay even though one of them is past the window, everything older goes.
    const newest = (target: 'db' | 'keys') => [0, 2, 40].map((d) => backupKey(target, at(d)));
    expect(keys).toEqual([...newest('db'), ...newest('keys')].sort());
  });

  it('does not ping and reports failure when one dump fails, but still backs up the other', async () => {
    const s = await setup();
    s.runner.failDump = 'ad_keys';
    const report = await runBackup(s.deps);
    expect(report.ok).toBe(false);
    expect(report.targets.find((t) => t.target === 'keys')).toMatchObject({ ok: false });
    expect(report.targets.find((t) => t.target === 'keys')!.error).toContain('pg_dump failed');
    expect(report.targets.find((t) => t.target === 'db')).toMatchObject({ ok: true });
    expect(s.pings).toEqual([]);
    expect((await s.storage.list('')).map((o) => o.key)).toEqual([backupKey('db', s.now)]);
  });

  it('removes the plain dump from the work folder, even when something fails', async () => {
    const s = await setup();
    s.runner.failDump = 'ad';
    await runBackup(s.deps);
    expect(await readdir(join(s.root, 'work')).catch(() => [])).toEqual([]);
  });

  it('never leaks a password into the report', async () => {
    const s = await setup();
    s.runner.failDump = 'ad';
    const report = await runBackup(s.deps);
    expect(JSON.stringify(report)).not.toContain('pw@');
    expect(JSON.stringify(report)).not.toContain('PGPASSWORD');
  });
});
