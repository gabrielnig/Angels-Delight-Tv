import { createDb, type Database } from '@ad/db';
import { createTestDatabase, type TestDatabase } from '@ad/db/testing';
import { Mailer, MemoryTransport } from '@ad/mailer';
import { AuditWriter, LockoutStore, RateLimiter } from '@ad/security';
import pg from 'pg';
import { KeyService } from './keys';
import { PasswordHasher } from './password';
import { SessionService } from './sessions';
import { NO_META, type AuthDeps, type RequestMeta } from './types';

/** Test helpers. Opens connections that run as a service role so grants and row level security really apply. */
export interface RoleDb {
  db: Database;
  pool: pg.Pool;
}

export function connectAs(url: string, role: string): RoleDb {
  const pool = new pg.Pool({ connectionString: url, max: 4, options: `-c role=${role}` });
  // An idle connection cut by DROP DATABASE must not surface as an unhandled error after a test file ends.
  pool.on('error', () => undefined);
  return { db: createDb(pool), pool };
}

export interface AuthTestDatabases {
  admin: TestDatabase;
  app: RoleDb;
  keys: RoleDb;
  shred: RoleDb;
  drop(): Promise<void>;
}

export async function createAuthTestDatabases(): Promise<AuthTestDatabases> {
  const admin = await createTestDatabase();
  const app = connectAs(admin.url, 'ad_app');
  const keys = connectAs(admin.keysUrl, 'ad_keys_app');
  const shred = connectAs(admin.keysUrl, 'ad_keys_shred');
  return {
    admin,
    app,
    keys,
    shred,
    async drop() {
      await Promise.all([app.pool.end(), keys.pool.end(), shred.pool.end()]);
      await admin.drop();
    },
  };
}

export const TEST_PASSWORD = 'river-lantern-42-mango';

export interface AuthHarness {
  dbs: AuthTestDatabases;
  deps: AuthDeps;
  transport: MemoryTransport;
  readonly meta: RequestMeta;
  /** A request from a new client address every time it is read, so tests do not share rate limit buckets. */
  /** Moves the shared test clock to START plus the given seconds. */
  at(seconds: number): void;
  advance(seconds: number): void;
  settle(): Promise<void>;
  /** The newest six digit code mailed to this address. */
  codeFor(email: string): string;
  /** The newest link token mailed to this address. */
  tokenFor(email: string): string;
  mailsTo(email: string): number;
  drop(): Promise<void>;
}

const START = Date.parse('2026-03-01T10:00:00Z');

/** Everything the auth services need, wired to real throwaway databases and an in-memory mailbox. */
export async function createAuthHarness(overrides: Partial<AuthDeps> = {}): Promise<AuthHarness> {
  const dbs = await createAuthTestDatabases();
  let now = START;
  const clock = () => new Date(now);
  const transport = new MemoryTransport();
  const pending: Promise<unknown>[] = [];
  const pepper = new Uint8Array(32).fill(9);
  const kek = new Uint8Array(32).fill(5);
  const mailer = new Mailer(transport, {
    from: 'Angels Delight TV <no-reply@example.org>',
    appName: 'Angels Delight TV',
    appOrigin: 'https://tv.example.org',
    supportEmail: 'help@example.org',
  });
  const deps: AuthDeps = {
    db: dbs.app.db,
    keys: new KeyService({ keysDb: dbs.keys.db, shredDb: dbs.shred.db, kek, clock: () => now }),
    sessions: new SessionService(dbs.app.db, { clock }),
    hasher: new PasswordHasher({ memoryKib: 8, timeCost: 1, parallelism: 1 }),
    limiter: new RateLimiter(dbs.app.db, { clock }),
    lockouts: new LockoutStore(dbs.app.db, { clock }),
    audit: new AuditWriter(dbs.app.db),
    mailer,
    pepper,
    kek,
    clock,
    background: (task) => {
      pending.push(task.catch(() => undefined));
    },
    ...overrides,
  };
  let ipCounter = 0;
  const outboxFor = (email: string) => transport.outbox.filter((mail) => mail.to === email);
  return {
    dbs,
    deps,
    transport,
    get meta(): RequestMeta {
      ipCounter++;
      const ip = `203.0.${Math.floor(ipCounter / 250)}.${(ipCounter % 250) + 1}`;
      return {
        ...NO_META,
        ip,
        ipTrunc: `203.0.${Math.floor(ipCounter / 250)}.0/24`,
        userAgent: 'TestAgent/1.0',
      };
    },
    at(seconds) {
      now = START + seconds * 1000;
    },
    advance(seconds) {
      now += seconds * 1000;
    },
    async settle() {
      await Promise.all(pending.splice(0));
    },
    codeFor(email) {
      const mail = outboxFor(email).at(-1);
      const match = /Your code: (\d{6})/.exec(mail?.text ?? '');
      if (!match?.[1]) throw new Error(`No code mailed to ${email}`);
      return match[1];
    },
    tokenFor(email) {
      const mail = outboxFor(email).at(-1);
      const match = /token=([^\s&]+)/.exec(mail?.text ?? '');
      if (!match?.[1]) throw new Error(`No token mailed to ${email}`);
      return decodeURIComponent(match[1]);
    },
    mailsTo: (email) => outboxFor(email).length,
    async drop() {
      await Promise.all(pending.splice(0));
      await dbs.drop();
    },
  };
}
