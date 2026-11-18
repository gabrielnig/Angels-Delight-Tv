import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';

const script = resolve(import.meta.dirname, '../ops/deploy.sh');

/**
 * deploy.sh is exercised with a fake `docker`, `git` and `curl` on the PATH. The fakes append every call to a log and
 * fail on demand, so the order of steps, the abort on a failed migration and the rollback are all checked without a
 * daemon.
 */
interface Env {
  dir: string;
  log: string;
  app: string;
  run(
    args: string[],
    extra?: Record<string, string>,
  ): { code: number | null; out: string; calls: string[] };
}

function setup(): Env {
  const dir = mkdtempSync(join(tmpdir(), 'ad-deploy-'));
  const bin = join(dir, 'bin');
  const app = join(dir, 'app');
  const repo = join(dir, 'repo');
  mkdirSync(bin);
  mkdirSync(app);
  mkdirSync(repo);
  writeFileSync(join(app, '.env'), 'APP_DOMAIN=tv.example.org\n');
  const log = join(dir, 'calls.log');
  writeFileSync(log, '');
  writeFileSync(
    join(bin, 'docker'),
    `#!/usr/bin/env bash
echo "docker TAG=\${TAG:-} $*" >> "${log}"
case "$*" in
  *"pull"*) [ "\${FAKE_FAIL:-}" = pull ] && exit 1 ;;
  *"run --rm migrate"*|*"run --rm --no-deps migrate"*) [ "\${FAKE_FAIL:-}" = migrate ] && exit 1 ;;
  *"exec -T web"*) [ -n "\${FAKE_UNHEALTHY_TAG:-}" ] && [ "\${TAG:-}" = "$FAKE_UNHEALTHY_TAG" ] && exit 1 ;;
esac
exit 0
`,
  );
  writeFileSync(
    join(bin, 'git'),
    `#!/usr/bin/env bash\necho "git $*" >> "${log}"\n[ "\${FAKE_FAIL:-}" = git ] && exit 1\nexit 0\n`,
  );
  writeFileSync(join(bin, 'sleep'), '#!/usr/bin/env bash\nexit 0\n');
  for (const name of ['docker', 'git', 'sleep']) chmodSync(join(bin, name), 0o755);
  return {
    dir,
    log,
    app,
    run(args, extra = {}) {
      const result = spawnSync('bash', [script, ...args], {
        env: {
          PATH: `${bin}:${process.env.PATH}`,
          APP_DIR: app,
          REPO_DIR: repo,
          HEALTH_TIMEOUT: '3',
          HEALTH_INTERVAL: '1',
          ...extra,
        },
        encoding: 'utf8',
      });
      return {
        code: result.status,
        out: result.stdout + result.stderr,
        calls: readFileSync(log, 'utf8').split('\n').filter(Boolean),
      };
    },
  };
}

const state = (env: Env, name: string) => {
  const file = join(env.app, '.deploy', name);
  return existsSync(file) ? readFileSync(file, 'utf8').trim() : null;
};

describe('ops/deploy.sh', () => {
  let env: Env;
  beforeEach(() => {
    env = setup();
  });

  it('refuses to run without a tag', () => {
    const result = env.run([]);
    expect(result.code).toBe(2);
    expect(result.out).toContain('Usage');
  });

  it('checks out the tag, pulls, migrates, restarts, waits for health and records the release', () => {
    const result = env.run(['abc123']);
    expect(result.code, result.out).toBe(0);
    const calls = result.calls.map((c) => c.replace(/^docker TAG=\S* /, 'docker '));
    const index = (needle: string) => calls.findIndex((c) => c.includes(needle));
    expect(index('git')).toBeGreaterThanOrEqual(0);
    expect(index('pull')).toBeGreaterThan(index('git'));
    expect(index('up -d --wait postgres')).toBeGreaterThan(index('pull'));
    expect(index('run --rm migrate')).toBeGreaterThan(index('up -d --wait postgres'));
    expect(index('up -d --remove-orphans')).toBeGreaterThan(index('run --rm migrate'));
    expect(index('exec -T web')).toBeGreaterThan(index('up -d --remove-orphans'));
    expect(state(env, 'current')).toBe('abc123');
    expect(state(env, 'previous')).toBeNull();
  });

  it('passes the tag and the env file to compose', () => {
    const result = env.run(['abc123']);
    expect(
      result.calls.some(
        (c) =>
          c.startsWith('docker TAG=abc123 ') &&
          c.includes('--env-file') &&
          c.includes('compose.prod.yaml'),
      ),
    ).toBe(true);
  });

  it('keeps the old release as previous after a second deploy', () => {
    env.run(['v1']);
    env.run(['v2']);
    expect(state(env, 'current')).toBe('v2');
    expect(state(env, 'previous')).toBe('v1');
  });

  it('aborts before touching the running app when the migration fails', () => {
    env.run(['v1']);
    const result = env.run(['v2'], { FAKE_FAIL: 'migrate' });
    expect(result.code).toBe(1);
    expect(result.out).toMatch(/migration failed/i);
    expect(state(env, 'current')).toBe('v1');
    const afterFailure = result.calls.slice(
      result.calls.findIndex((c) => c.includes('TAG=v2') && c.includes('migrate')),
    );
    expect(afterFailure.some((c) => c.includes('up -d --remove-orphans'))).toBe(false);
  });

  it('rolls back to the current release when the new one never becomes healthy', () => {
    env.run(['v1']);
    const result = env.run(['v2'], { FAKE_UNHEALTHY_TAG: 'v2' });
    expect(result.code).toBe(1);
    expect(result.out).toMatch(/rolling back to v1/i);
    expect(state(env, 'current')).toBe('v1');
    expect(
      result.calls.some(
        (c) => c.startsWith('docker TAG=v1 ') && c.includes('up -d --remove-orphans'),
      ),
    ).toBe(true);
  });

  it('on a first deploy that is unhealthy there is nothing to roll back to and it says so', () => {
    const result = env.run(['v1'], { FAKE_UNHEALTHY_TAG: 'v1' });
    expect(result.code).toBe(1);
    expect(result.out).toMatch(/no previous release/i);
    expect(state(env, 'current')).toBeNull();
  });

  it('--rollback redeploys the previous release without migrating', () => {
    env.run(['v1']);
    env.run(['v2']);
    const result = env.run(['--rollback']);
    expect(result.code, result.out).toBe(0);
    expect(
      result.calls
        .slice(-6)
        .some((c) => c.startsWith('docker TAG=v1 ') && c.includes('up -d --remove-orphans')),
    ).toBe(true);
    expect(
      result.calls
        .slice(result.calls.findIndex((c) => c.includes('rollback') || true))
        .filter((c) => c.includes('run --rm migrate')).length,
    ).toBe(2);
    expect(state(env, 'current')).toBe('v1');
    expect(state(env, 'previous')).toBe('v2');
  });

  it('--rollback says so when there is nothing to roll back to', () => {
    env.run(['v1']);
    const result = env.run(['--rollback']);
    expect(result.code).toBe(1);
    expect(result.out).toMatch(/no previous release/i);
  });

  it('stops when the pull fails and changes nothing', () => {
    env.run(['v1']);
    const result = env.run(['v2'], { FAKE_FAIL: 'pull' });
    expect(result.code).toBe(1);
    expect(state(env, 'current')).toBe('v1');
  });

  it('can skip the git checkout for a server that is not a clone', () => {
    const result = env.run(['v1'], { SKIP_GIT: '1' });
    expect(result.code, result.out).toBe(0);
    expect(result.calls.some((c) => c.startsWith('git'))).toBe(false);
  });

  it('never prints secrets from the env file', () => {
    writeFileSync(join(env.app, '.env'), 'APP_DOMAIN=tv.example.org\nFIELD_KEK=supersecretvalue\n');
    const result = env.run(['v1']);
    expect(result.out).not.toContain('supersecretvalue');
  });
});
