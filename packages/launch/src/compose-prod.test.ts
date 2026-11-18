import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '../../..');
const hasCompose = spawnSync('docker', ['compose', 'version'], { stdio: 'ignore' }).status === 0;

const env = {
  ...process.env,
  ENV_FILE: '.env.production.example',
  TAG: 'testtag',
  POSTGRES_PASSWORD: 'x',
  DB_PASSWORD_MIGRATOR: 'x',
  DB_PASSWORD_APP: 'x',
  DB_PASSWORD_WORKER: 'x',
  DB_PASSWORD_KEYS_APP: 'x',
  DB_PASSWORD_KEYS_SHRED: 'x',
  DB_PASSWORD_MAINTENANCE: 'x',
  APP_DOMAIN: 'tv.example.org',
  BACKUP_PUBLIC_KEY_DB_B64: 'x',
  BACKUP_PUBLIC_KEY_KEYS_B64: 'x',
  BACKUP_S3_ENDPOINT: 'https://x.example',
  BACKUP_S3_ACCESS_KEY_ID: 'x',
  BACKUP_S3_SECRET_ACCESS_KEY: 'x',
};

interface Service {
  image: string;
  ports?: { target: number; published: string }[];
  read_only?: boolean;
  networks?: Record<string, unknown>;
  environment?: Record<string, string>;
  profiles?: string[];
  cap_drop?: string[];
}

function load(
  extra: Record<string, string> = {},
  profiles = ['ops'],
): {
  services: Record<string, Service>;
  networks: Record<string, { internal?: boolean }>;
} {
  const args = [
    'compose',
    '-f',
    'compose.prod.yaml',
    ...profiles.flatMap((p) => ['--profile', p]),
    'config',
    '--format',
    'json',
  ];
  return JSON.parse(
    execFileSync('docker', args, { cwd: root, env: { ...env, ...extra }, encoding: 'utf8' }),
  );
}

describe.skipIf(!hasCompose)('compose.prod.yaml', () => {
  it('is valid and has every service the launch needs', () => {
    const { services } = load();
    expect(Object.keys(services).sort()).toEqual(
      ['backup', 'caddy', 'migrate', 'postgres', 'tools', 'web', 'whisper', 'worker'].sort(),
    );
  });

  it('refuses to start without a release tag or generated secrets', () => {
    const run = (extra: Record<string, string>) =>
      spawnSync('docker', ['compose', '-f', 'compose.prod.yaml', 'config', '-q'], {
        cwd: root,
        env: { ...env, ...extra },
        encoding: 'utf8',
      });
    expect(run({ TAG: '' }).status).not.toBe(0);
    expect(run({ POSTGRES_PASSWORD: '' }).status).not.toBe(0);
    expect(run({ DB_PASSWORD_APP: '' }).status).not.toBe(0);
  });

  it('publishes only ports 80 and 443, both on caddy', () => {
    const { services } = load();
    const published = Object.entries(services).flatMap(([name, service]) =>
      (service.ports ?? []).map((port) => `${name}:${port.published}`),
    );
    expect(published.sort()).toEqual(['caddy:443', 'caddy:80']);
  });

  it('keeps Postgres on a network with no route out and off the edge network', () => {
    const { services, networks } = load();
    expect(networks.backend?.internal).toBe(true);
    expect(Object.keys(services.postgres!.networks ?? {})).toEqual(['backend']);
  });

  it('runs web, worker and whisper read only with every capability dropped', () => {
    const { services } = load();
    for (const name of ['web', 'worker', 'whisper']) {
      expect(services[name]!.read_only, name).toBe(true);
      expect(services[name]!.cap_drop, name).toEqual(['ALL']);
    }
  });

  it('gives each container only its own database role', () => {
    const { services } = load({ DB_PASSWORD_APP: 'app-pw', DB_PASSWORD_MIGRATOR: 'mig-pw' });
    const web = JSON.stringify(services.web!.environment);
    expect(web).toContain('ad_app:app-pw');
    expect(web).not.toContain('mig-pw');
    expect(web).not.toContain('ad_migrator');
    expect(JSON.stringify(services.worker!.environment)).not.toContain('ad_migrator');
    expect(JSON.stringify(services.migrate!.environment)).toContain('ad_migrator:mig-pw');
  });

  it('gives the tools service what seed-admin needs and nothing else privileged', () => {
    const { services } = load();
    const tools = services.tools!.environment!;
    expect(tools.DATABASE_URL_MIGRATE).toContain('ad_migrator');
    expect(tools.KEYS_DATABASE_URL).toContain('ad_keys_app');
    expect(JSON.stringify(tools)).not.toContain('postgres:x@');
  });

  it('keeps the migrate, tools and backup services out of a plain up', () => {
    const { services } = load({}, []);
    expect(Object.keys(services)).not.toContain('migrate');
    expect(Object.keys(services)).not.toContain('backup');
    expect(Object.keys(services)).toContain('web');
  });

  it('pulls images by tag and never builds', () => {
    const { services } = load();
    for (const [name, service] of Object.entries(services)) {
      expect(JSON.stringify(service), name).not.toContain('"build"');
    }
    expect(services.web!.image).toBe('ghcr.io/gabrielnig/angels-delight-tv-web:testtag');
  });
});

describe('compose.prod.yaml variables', () => {
  it('only references variables that the env example, deploy.sh or the compose defaults provide', () => {
    const compose = readFileSync(resolve(root, 'compose.prod.yaml'), 'utf8');
    const example = readFileSync(resolve(root, '.env.production.example'), 'utf8');
    const used = new Set([...compose.matchAll(/\$\{([A-Z][A-Z0-9_]*)/g)].map((m) => m[1]!));
    const provided = new Set([...example.matchAll(/^([A-Z][A-Z0-9_]*)=/gm)].map((m) => m[1]!));
    // Set by deploy.sh or compose itself, not by the env file.
    for (const name of ['TAG', 'ENV_FILE', 'POSTGRES_IMAGE', 'CADDY_IMAGE']) provided.add(name);
    expect([...used].filter((name) => !provided.has(name))).toEqual([]);
  });
});
