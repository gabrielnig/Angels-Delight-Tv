import { spawn } from 'node:child_process';
import { createServer, type Server } from 'node:http';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const script = resolve(import.meta.dirname, 'check-headers.sh');

const GOOD: Record<string, string> = {
  'content-security-policy': "default-src 'self'; script-src 'self' 'nonce-abc'; frame-ancestors 'none'",
  'strict-transport-security': 'max-age=31536000; includeSubDomains',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=()',
};

let server: Server | undefined;
afterEach(() => server?.close());

async function serve(headers: Record<string, string>): Promise<string> {
  server = createServer((_req, res) => {
    for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
    res.end('ok');
  });
  await new Promise<void>((r) => server!.listen(0, '127.0.0.1', r));
  const addr = server.address() as { port: number };
  return `http://127.0.0.1:${addr.port}/`;
}

function run(url: string, ...extra: string[]): Promise<{ code: number | null; output: string }> {
  return new Promise((done) => {
    const child = spawn('bash', [script, url, ...extra]);
    let output = '';
    child.stdout.on('data', (d) => (output += d));
    child.stderr.on('data', (d) => (output += d));
    child.on('close', (code) => done({ code, output }));
  });
}

describe('check-headers', () => {
  it('passes when every required header is present and sound', async () => {
    const r = await run(await serve(GOOD), '--allow-http');
    expect(r.code).toBe(0);
  });

  for (const missing of Object.keys(GOOD)) {
    it(`fails when ${missing} is missing`, async () => {
      const { [missing]: _drop, ...rest } = GOOD;
      const r = await run(await serve(rest), '--allow-http');
      expect(r.code).toBe(1);
      expect(r.output.toLowerCase()).toContain(missing);
    });
  }

  it('fails on a CSP with unsafe-inline scripts or no frame-ancestors', async () => {
    const weak = { ...GOOD, 'content-security-policy': "default-src 'self'; script-src 'unsafe-inline'" };
    const r = await run(await serve(weak), '--allow-http');
    expect(r.code).toBe(1);
  });

  it('fails on a weak HSTS max-age and a wrong nosniff value', async () => {
    expect((await run(await serve({ ...GOOD, 'strict-transport-security': 'max-age=60' }), '--allow-http')).code).toBe(1);
    expect((await run(await serve({ ...GOOD, 'x-content-type-options': 'sniff' }), '--allow-http')).code).toBe(1);
  });

  it('refuses a plain http url unless --allow-http is given, and needs a url', async () => {
    expect((await run(await serve(GOOD))).code).toBe(2);
    const r = await run('');
    expect(r.code).toBe(2);
  });
});
