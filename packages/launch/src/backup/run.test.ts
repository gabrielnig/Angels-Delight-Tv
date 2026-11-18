import { generateKeyPairSync } from 'node:crypto';
import { mkdtemp, readdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LocalStorage } from '@ad/storage';
import { describe, expect, it } from 'vitest';
import { localPartWriter } from '../import/service-ports';
import { decryptBackupFile } from './crypto';
import { manifestKey, parseManifest, sha256Hex } from './manifest';
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
        keepDaily: 14,
        keepWeekly: 8,
      },
      {
        target: 'keys' as const,
        url: 'postgres://postgres:pw@postgres:5432/ad_keys',
        publicKey: keysKeys.publicKey,
        keepDaily: 14,
        keepWeekly: 0,
        maxAgeDays: 14,
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
      [
        backupKey('db', s.now),
        manifestKey(backupKey('db', s.now)),
        backupKey('keys', s.now),
        manifestKey(backupKey('keys', s.now)),
      ].sort(),
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

  it('writes a manifest with the size and checksum of the stored file', async () => {
    const s = await setup();
    await runBackup(s.deps);
    const key = backupKey('db', s.now);
    const chunks: Buffer[] = [];
    for await (const c of await s.storage.get(key)) chunks.push(Buffer.from(c));
    const stored = Buffer.concat(chunks);
    const text: Buffer[] = [];
    for await (const c of await s.storage.get(manifestKey(key))) text.push(Buffer.from(c));
    const manifest = parseManifest(Buffer.concat(text).toString());
    expect(manifest).toEqual({
      version: 1,
      key,
      target: 'db',
      takenAt: s.now.toISOString(),
      bytes: stored.length,
      sha256: sha256Hex(stored),
    });
  });

  it('fails and removes the backup when the manifest cannot be written', async () => {
    const s = await setup();
    const put = s.storage.put.bind(s.storage);
    const failing = Object.assign(Object.create(s.storage), {
      put: async (key: string, ...rest: unknown[]) => {
        if (key.endsWith('.manifest.json')) throw new Error('disk full');
        return (put as (...args: unknown[]) => Promise<unknown>)(key, ...rest);
      },
    });
    const report = await runBackup({ ...s.deps, storage: failing });
    expect(report.ok).toBe(false);
    expect(s.pings).toEqual([]);
    expect(await s.storage.list('')).toEqual([]);
  });

  it('keeps 14 daily and 8 weekly for the main database and only 14 days of the keys database', async () => {
    const s = await setup();
    const DAY = 86_400_000;
    // One backup a night for 100 nights, ending today.
    for (let d = 99; d >= 0; d--) {
      await runBackup({ ...s.deps, now: () => new Date(s.now.getTime() - d * DAY) });
    }
    const list = await s.storage.list('');
    const dumps = (target: string) =>
      list.filter((o) => o.key.startsWith(`${target}/`) && o.key.endsWith('.dump.enc'));
    const manifests = (target: string) =>
      list.filter((o) => o.key.startsWith(`${target}/`) && o.key.endsWith('.manifest.json'));
    expect(dumps('db')).toHaveLength(22);
    expect(manifests('db')).toHaveLength(22);
    expect(dumps('keys')).toHaveLength(14);
    expect(manifests('keys')).toHaveLength(14);
    const oldestKeys = Math.min(
      ...dumps('keys').map((o) =>
        Date.parse(
          o.key
            .match(/(\d{8}T\d{6}Z)/)![1]!
            .replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z/, '$1-$2-$3T$4:$5:$6Z'),
        ),
      ),
    );
    expect(s.now.getTime() - oldestKeys).toBeLessThanOrEqual(14 * DAY);
    expect(list.some((o) => o.key === backupKey('db', s.now))).toBe(true);
  }, 60_000);

  it('removes a manifest whose backup is gone and never deletes a backup that has no manifest', async () => {
    const s = await setup();
    // A backup from before manifests existed, and a manifest left behind.
    const legacy = backupKey('db', new Date(s.now.getTime() - 1 * 86_400_000));
    await s.storage.put(legacy, Buffer.from('legacy'));
    await s.storage.put('db/ad-20200101T000000Z.dump.enc.manifest.json', Buffer.from('{}'));
    await runBackup(s.deps);
    const keys = (await s.storage.list('db/')).map((o) => o.key);
    expect(keys).toContain(legacy);
    expect(keys).not.toContain('db/ad-20200101T000000Z.dump.enc.manifest.json');
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
    expect((await s.storage.list('')).map((o) => o.key).sort()).toEqual(
      [backupKey('db', s.now), manifestKey(backupKey('db', s.now))].sort(),
    );
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
