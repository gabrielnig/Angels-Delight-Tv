import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const caddy = process.env.CADDY_BIN ?? 'caddy';
const hasCaddy = spawnSync(caddy, ['version'], { stdio: 'ignore' }).status === 0;
const file = resolve(import.meta.dirname, '../../../ops/Caddyfile');
const text = readFileSync(file, 'utf8');

describe('ops/Caddyfile', () => {
  it('strips playback tokens, signatures and auth headers from the access log', () => {
    for (const name of ['pt', 'sig', 'exp', 'token'])
      expect(text).toMatch(new RegExp(`delete ${name}\\b`));
    expect(text).toContain('request>headers>Authorization delete');
    expect(text).toContain('request>headers>Cookie delete');
    expect(text).toContain('resp_headers>Set-Cookie delete');
  });

  it('uses the Origin CA certificate and never asks for a public one', () => {
    expect(text).toContain('auto_https off');
    expect(text).toContain('tls /etc/caddy/certs/origin.pem /etc/caddy/certs/origin.key');
  });

  it('caps request bodies, because uploads go straight to storage', () => {
    expect(text).toContain('max_size 2MB');
  });

  it.skipIf(!hasCaddy)('is accepted by caddy validate', () => {
    const dir = mkdtempSync(join(tmpdir(), 'caddy-validate-'));
    const openssl = spawnSync('openssl', [
      'req',
      '-x509',
      '-newkey',
      'rsa:2048',
      '-nodes',
      '-keyout',
      join(dir, 'origin.key'),
      '-out',
      join(dir, 'origin.pem'),
      '-days',
      '2',
      '-subj',
      '/CN=localhost',
    ]);
    expect(openssl.status).toBe(0);
    const adapted = join(dir, 'Caddyfile');
    writeFileSync(
      adapted,
      text
        .replaceAll('/etc/caddy/certs', dir)
        .replaceAll('/srv/maintenance', dir)
        .replaceAll('/var/log/caddy', dir),
    );
    const result = spawnSync(caddy, ['validate', '--config', adapted, '--adapter', 'caddyfile'], {
      env: { ...process.env, APP_DOMAIN: 'tv.example.org' },
      encoding: 'utf8',
    });
    expect(result.stderr + result.stdout).toContain('Valid configuration');
    expect(result.status).toBe(0);
  });
});
