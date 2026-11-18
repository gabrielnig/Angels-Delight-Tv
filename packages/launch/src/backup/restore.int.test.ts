import { generateKeyPairSync } from 'node:crypto';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LocalStorage } from '@ad/storage';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { localPartWriter } from '../import/service-ports';
import { runBackup, nodeRunner } from './run';
import { RestoreRefused, runRestore } from './restore';

const adminUrl = process.env.TEST_DATABASE_ADMIN_URL;
const secret = new Uint8Array(32).fill(5);
const suffix = `${Date.now().toString(36)}`;
const source = `ad_bk_src_${suffix}`;
const scratch = `ad_bk_scratch_${suffix}`;

const withDb = (name: string) => {
  const url = new URL(adminUrl!);
  url.pathname = `/${name}`;
  return url.toString();
};

async function admin<T>(
  sql: string,
  db = 'postgres',
): Promise<pg.QueryResult<T & pg.QueryResultRow>> {
  const client = new pg.Client({ connectionString: withDb(db) });
  await client.connect();
  try {
    return await client.query(sql);
  } finally {
    await client.end();
  }
}

describe.skipIf(!adminUrl)('backup and restore with a real Postgres', () => {
  const keys = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  let storage: LocalStorage;
  let work: string;

  beforeAll(async () => {
    await admin(`CREATE DATABASE ${source}`);
    await admin(`CREATE DATABASE ${scratch}`);
    // A table with row level security forced on, like the real schema: only a superuser can read every row.
    await admin(
      `CREATE TABLE accounts (id serial primary key, email text not null, secret bytea);
       ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
       ALTER TABLE accounts FORCE ROW LEVEL SECURITY;
       CREATE POLICY none ON accounts USING (false);
       INSERT INTO accounts (email, secret) SELECT 'user' || n || '@example.org', decode('00ff', 'hex') FROM generate_series(1, 250) n;
       CREATE VIEW account_count AS SELECT count(*) AS n FROM accounts;`,
      source,
    );
    work = await mkdtemp(join(tmpdir(), 'ad-restore-test-'));
    storage = new LocalStorage({
      root: join(work, 'r2'),
      bucket: 'ad-backups',
      signingSecret: secret,
    });
  });

  afterAll(async () => {
    await admin(`DROP DATABASE IF EXISTS ${source} WITH (FORCE)`);
    await admin(`DROP DATABASE IF EXISTS ${scratch} WITH (FORCE)`);
  });

  it('backs up, restores into a scratch database and finds every row', async () => {
    const report = await runBackup({
      storage,
      runner: nodeRunner,
      now: () => new Date('2026-11-18T02:30:00Z'),
      localDir: join(work, 'local'),
      workDir: join(work, 'work'),
      writePart: localPartWriter(storage, secret),
      targets: [{ target: 'db', url: withDb(source), publicKey: keys.publicKey, retainDays: 35 }],
      retainLocalDays: 7,
    });
    expect(report.ok, JSON.stringify(report)).toBe(true);

    const restored = await runRestore({
      storage,
      runner: nodeRunner,
      workDir: join(work, 'restore'),
      target: 'db',
      key: 'latest',
      privateKey: keys.privateKey,
      targetUrl: withDb(scratch),
      protectedDatabases: ['ad', 'ad_keys'],
      verifySql: 'SELECT count(*)::int AS n FROM accounts',
    });
    expect(restored.key).toBe('db/ad-20261118T023000Z.dump.enc');
    expect(restored.verify).toEqual({ n: 250 });

    const rows = await admin<{ email: string; secret: Buffer }>(
      'SELECT email, secret FROM accounts WHERE id = 7',
      scratch,
    );
    expect(rows.rows[0]!.email).toBe('user7@example.org');
    expect(rows.rows[0]!.secret.toString('hex')).toBe('00ff');
    const policy = await admin<{ n: number }>(
      "SELECT count(*)::int AS n FROM pg_policies WHERE tablename = 'accounts'",
      scratch,
    );
    expect(policy.rows[0]!.n).toBe(1);
  });

  it('refuses to restore over the live databases', async () => {
    await expect(
      runRestore({
        storage,
        runner: nodeRunner,
        workDir: join(work, 'restore2'),
        target: 'db',
        key: 'latest',
        privateKey: keys.privateKey,
        targetUrl: withDb('ad'),
        protectedDatabases: ['ad', 'ad_keys'],
      }),
    ).rejects.toThrow(RestoreRefused);
  });

  it('fails clearly with the wrong private key and leaves the scratch database untouched', async () => {
    const wrong = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    await expect(
      runRestore({
        storage,
        runner: nodeRunner,
        workDir: join(work, 'restore3'),
        target: 'db',
        key: 'latest',
        privateKey: wrong.privateKey,
        targetUrl: withDb(scratch),
        protectedDatabases: [],
      }),
    ).rejects.toThrow(/does not open/);
  });

  it('says so when there is no backup to restore', async () => {
    const empty = new LocalStorage({
      root: join(work, 'empty'),
      bucket: 'ad-backups',
      signingSecret: secret,
    });
    await expect(
      runRestore({
        storage: empty,
        runner: nodeRunner,
        workDir: join(work, 'restore4'),
        target: 'keys',
        key: 'latest',
        privateKey: keys.privateKey,
        targetUrl: withDb(scratch),
        protectedDatabases: [],
      }),
    ).rejects.toThrow(/No keys backups/);
  });
});
