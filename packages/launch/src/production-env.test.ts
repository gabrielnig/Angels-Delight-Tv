import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ENV_VARIABLE_NAMES, loadMigrateEnv, loadWebEnv, loadWorkerEnv } from '@ad/config';
import { describe, expect, it } from 'vitest';
import { GENERATED_SECRET_NAMES } from './secrets';
import { PRODUCTION_ONLY_VARIABLES } from './production-env';
import { envValuesFor } from './env-file';

const text = readFileSync(resolve(import.meta.dirname, '../../../.env.production.example'), 'utf8');
const lines = text.split('\n');

const setNames = lines
  .map((line) => /^([A-Z][A-Z0-9_]+)=/.exec(line)?.[1])
  .filter(Boolean) as string[];
const TAGS = ['[client]', '[owner]', '[generated]', '[default]', '[applied]'];

/** Built by compose.prod.yaml, so deliberately absent from the file. */
const COMPOSE_PROVIDED = [
  'DATABASE_URL',
  'DATABASE_URL_WORKER',
  'DATABASE_URL_MAINTENANCE',
  'DATABASE_URL_MIGRATE',
  'KEYS_DATABASE_URL',
  'KEYS_DATABASE_URL_MIGRATE',
  'KEYS_DATABASE_URL_SHRED',
  'LOCAL_STORAGE_ROOT',
  'WORKER_SCRATCH_DIR',
  'WHISPER_FAKE',
];

describe('.env.production.example', () => {
  it('lists every variable the loaders read, except the ones compose provides', () => {
    const missing = ENV_VARIABLE_NAMES.filter(
      (name) => !setNames.includes(name) && !COMPOSE_PROVIDED.includes(name),
    );
    expect(missing).toEqual([]);
  });

  it('names the compose provided variables in a comment so nobody sets them twice', () => {
    for (const name of COMPOSE_PROVIDED) expect(text).toContain(name);
    for (const name of COMPOSE_PROVIDED) expect(setNames).not.toContain(name);
  });

  it('documents nothing that nothing reads', () => {
    const known = new Set<string>([...ENV_VARIABLE_NAMES, ...PRODUCTION_ONLY_VARIABLES]);
    expect(setNames.filter((name) => !known.has(name))).toEqual([]);
  });

  it('gives every variable a tag line above it saying who provides it', () => {
    const untagged: string[] = [];
    lines.forEach((line, index) => {
      const name = /^([A-Z][A-Z0-9_]+)=/.exec(line)?.[1];
      if (!name) return;
      let at = index - 1;
      while (at >= 0 && /^[A-Z][A-Z0-9_]+=/.test(lines[at]!)) at--;
      const comment = lines[at] ?? '';
      if (!comment.startsWith('#') || !TAGS.some((tag) => comment.includes(tag)))
        untagged.push(name);
    });
    expect(untagged).toEqual([]);
  });

  it('marks every generated secret as generated and leaves it empty', () => {
    for (const name of GENERATED_SECRET_NAMES) {
      const index = lines.findIndex((line) => line.startsWith(`${name}=`));
      expect(index, name).toBeGreaterThan(-1);
      expect(lines[index]).toBe(`${name}=`);
      let at = index - 1;
      while (at >= 0 && /^[A-Z][A-Z0-9_]+=/.test(lines[at]!)) at--;
      expect(lines[at], name).toContain('[generated]');
    }
  });

  it('carries no secret values', () => {
    const filled = lines.filter((line) =>
      /^(FIELD_KEK|EMAIL_HASH_PEPPER|HLS_KEK|PLAYBACK_TOKEN_SECRET|MEDIA_URL_SECRET|S3_SECRET_ACCESS_KEY|BACKUP_S3_SECRET_ACCESS_KEY|SMTP_URL|POSTGRES_PASSWORD|DB_PASSWORD_[A-Z_]+)=\S/.test(
        line,
      ),
    );
    expect(filled).toEqual([]);
  });

  it('names every value launch:apply writes, so the applier and the file stay in step', () => {
    const written = Object.keys(
      envValuesFor({
        platformName: 'N',
        domain: 'a.example',
        supportEmail: 'a@a.example',
        adminOwnerEmail: 'o@a.example',
      }),
    );
    for (const name of written) {
      const index = lines.findIndex((line) => line.startsWith(`${name}=`));
      expect(index, name).toBeGreaterThan(-1);
    }
  });

  it('passes the real loaders once the empty required values are filled in', () => {
    const base: Record<string, string> = {};
    for (const line of lines) {
      const match = /^([A-Z][A-Z0-9_]+)=(.*)$/.exec(line);
      if (match && match[2] !== '') base[match[1]!] = match[2]!;
    }
    const key = (n: number) => Buffer.alloc(32, n).toString('base64');
    const env = {
      ...base,
      APP_ORIGIN: 'https://tv.example.org',
      MEDIA_ORIGIN: 'https://media.tv.example.org',
      SMTP_URL: 'smtps://u:p@smtp.example.org:465',
      EMAIL_FROM: 'TV <no-reply@tv.example.org>',
      S3_ENDPOINT: 'https://acct.r2.cloudflarestorage.com',
      S3_ACCESS_KEY_ID: 'id',
      S3_SECRET_ACCESS_KEY: 'secret',
      FIELD_KEK: key(1),
      EMAIL_HASH_PEPPER: key(2),
      HLS_KEK: key(3),
      PLAYBACK_TOKEN_SECRET: key(4),
      MEDIA_URL_SECRET: key(5),
      APP_VERSION: 'abc123',
      DATABASE_URL: 'postgres://ad_app:x@postgres:5432/ad',
      KEYS_DATABASE_URL: 'postgres://ad_keys_app:x@postgres:5432/ad_keys',
      KEYS_DATABASE_URL_SHRED: 'postgres://ad_keys_shred:x@postgres:5432/ad_keys',
      DATABASE_URL_WORKER: 'postgres://ad_worker:x@postgres:5432/ad',
      DATABASE_URL_MIGRATE: 'postgres://ad_migrator:x@postgres:5432/ad',
    };
    expect(() => loadWebEnv(env)).not.toThrow();
    expect(() => loadWorkerEnv(env)).not.toThrow();
    expect(() => loadMigrateEnv(env)).not.toThrow();
  });
});
